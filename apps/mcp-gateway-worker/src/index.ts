import { Hono } from "hono";
import {
  getAllTools,
  getToolByName,
  hasRequiredScopes,
  getDomainUrl,
} from "./registry";
import type { RPCRequest, RPCResponse, RPCContext } from "./types";

const app = new Hono();

// ============================================================================
// Helpers
// ============================================================================

/**
 * Generate a UUID for request tracing
 */
const generateRequestId = (): string => {
  // Simplified UUID generator for Cloudflare Workers
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Parse comma-separated header value into array
 */
const parseHeaderArray = (value: string | undefined): string[] => {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
};

/**
 * Check if origin is allowed (simple allowlist)
 */
const isOriginAllowed = (origin: string | undefined, allowlist: string): boolean => {
  if (!origin) return true; // Don't block requests without Origin header
  const allowed = parseHeaderArray(allowlist);
  return allowed.some((allowed_origin) =>
    origin.toLowerCase().includes(allowed_origin.toLowerCase())
  );
};

/**
 * Extract context from request headers
 */
const extractContext = (c: any): RPCContext => {
  return {
    tenant_id: c.req.header("x-tenant-id"),
    actor_id: c.req.header("x-actor-id"),
    scopes: parseHeaderArray(c.req.header("x-scopes")),
    request_id: generateRequestId(),
  };
};

/**
 * Call a remote RPC tool endpoint
 */
const callRemoteToolEndpoint = async (
  domainUrl: string | null,
  domainFetcher: { fetch: typeof fetch } | null,
  toolName: string,
  input: any,
  context: RPCContext,
  secret: string
): Promise<RPCResponse> => {
  const endpointPath = `/tools/${toolName}/invoke`;
  const endpoint = domainFetcher
    ? `https://service${endpointPath}`
    : `${domainUrl}${endpointPath}`;

  const rpcRequest: RPCRequest = {
    input,
    context,
  };

  try {
    const response = await (domainFetcher
      ? domainFetcher.fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-gateway-token": secret,
          },
          body: JSON.stringify(rpcRequest),
        })
      : fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-gateway-token": secret,
          },
          body: JSON.stringify(rpcRequest),
        }));

    if (!response.ok) {
      const error = await response.text();
      return {
        ok: false,
        error: {
          code: "UPSTREAM_ERROR",
          message: `Remote tool endpoint returned ${response.status}`,
          details: error,
        },
      };
    }

    const data = await response.json();
    return data as RPCResponse;
  } catch (error) {
    console.error(`Error calling remote endpoint ${endpoint}:`, error);
    return {
      ok: false,
      error: {
        code: "UPSTREAM_ERROR",
        message: "Failed to reach remote tool endpoint",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
};

/**
 * Get service binding fetcher for a domain, if configured
 */
const getDomainFetcher = (domain: "A" | "B", env: any) => {
  if (domain === "A") return env.DOMAIN_A_SERVICE || null;
  if (domain === "B") return env.DOMAIN_B_SERVICE || null;
  return null;
};

// ============================================================================
// MCP Endpoints
// ============================================================================

/**
 * GET /mcp - Show MCP endpoint info
 */
app.get("/mcp", (c) => {
  return c.json({
    endpoint: "/mcp",
    method: "POST",
    protocol: "JSON-RPC 2.0",
    methods: ["tools/list", "tools/call"],
    example: {
      method: "tools/list",
      jsonrpc: "2.0",
      id: 1,
    },
    documentation: "Send POST request with JSON-RPC 2.0 format",
  });
});

/**
 * MCP tools/list endpoint
 * Returns available tools with full metadata
 */
app.post("/mcp", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const method = body.method;
  const params = body.params || {};
  const id = body.id;
  const jsonrpc = body.jsonrpc || "2.0";

  // Always return MCP structure
  if (method === "tools/list") {
    const context = extractContext(c);
    const tools = getAllTools().map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));

    return c.json({
      jsonrpc,
      id,
      result: {
        tools,
      },
    });
  }

  // tools/call endpoint
  if (method === "tools/call") {
    const context = extractContext(c);
    const toolName = params.name;
    const toolInput = params.arguments || {};

    // Check if tool exists
    const tool = getToolByName(toolName);
    if (!tool) {
      return c.json(
        {
          jsonrpc,
          id,
          error: {
            code: -32601,
            message: `Tool '${toolName}' not found`,
            data: {
              code: "TOOL_NOT_FOUND",
              availableTools: getAllTools().map((t) => t.name),
            },
          },
        },
        404
      );
    }

    // Check scopes
    const userScopes = context.scopes || [];
    if (!hasRequiredScopes(userScopes, tool.requiredScopes)) {
      return c.json(
        {
          jsonrpc,
          id,
          error: {
            code: -32602,
            message: `Missing required scopes: ${tool.requiredScopes.join(", ")}`,
            data: {
              code: "SCOPE_MISSING",
              required: tool.requiredScopes,
              provided: userScopes,
            },
          },
        },
        403
      );
    }

    // Get domain target (service binding preferred)
    const env = c.env as any;
    const domainFetcher = getDomainFetcher(tool.domain, env);
    const domainUrl = getDomainUrl(tool.domain, env);
    if (!domainFetcher && !domainUrl) {
      return c.json(
        {
          jsonrpc,
          id,
          error: {
            code: -32603,
            message: `Domain ${tool.domain} target not configured`,
            data: { code: "UPSTREAM_ERROR" },
          },
        },
        500
      );
    }

    // Call remote endpoint
    const secret = env.DOMAIN_SHARED_SECRET;
    if (!secret) {
      return c.json(
        {
          jsonrpc,
          id,
          error: {
            code: -32603,
            message: "Gateway secret not configured",
            data: { code: "UPSTREAM_ERROR" },
          },
        },
        500
      );
    }

    const rpcResponse = await callRemoteToolEndpoint(
      domainUrl,
      domainFetcher,
      toolName,
      toolInput,
      context,
      secret
    );

    if (!rpcResponse.ok) {
      const error = rpcResponse.error;
      return c.json({
        jsonrpc,
        id,
        error: {
          code: -32603,
          message: error.message,
          data: {
            code: error.code,
            details: error.details,
          },
        },
      });
    }

    return c.json({
      jsonrpc,
      id,
      result: {
        content: [
          {
            type: "text",
            text: JSON.stringify(rpcResponse.data, null, 2),
          },
        ],
      },
    });
  }

  // Unknown method
  return c.json({
    jsonrpc,
    id,
    error: {
      code: -32601,
      message: `Unknown method: ${method}`,
    },
  });
});

// ============================================================================
// RESTful Endpoints (for direct testing)
// ============================================================================

/**
 * GET /tools - List all available tools
 */
app.get("/tools", (c) => {
  const tools = getAllTools().map((tool) => ({
    name: tool.name,
    description: tool.description,
    requiredScopes: tool.requiredScopes,
    domain: tool.domain,
  }));

  return c.json({
    ok: true,
    data: {
      tools,
      count: tools.length,
    },
  });
});

/**
 * POST /tools/:name/call - Call a tool via REST (non-MCP)
 */
app.post("/tools/:name/call", async (c) => {
  const toolName = c.req.param("name");
  const body = await c.req.json().catch(() => ({}));
  const toolInput = body.arguments || body.input || {};

  const context = extractContext(c);
  const env = c.env as any;

  // Check origin
  const origin = c.req.header("origin");
  const allowlist = env.ALLOWED_ORIGINS || "";
  if (!isOriginAllowed(origin, allowlist)) {
    return c.json(
      {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Origin not allowed",
        },
      },
      403
    );
  }

  // Check if tool exists
  const tool = getToolByName(toolName);
  if (!tool) {
    return c.json(
      {
        ok: false,
        error: {
          code: "TOOL_NOT_FOUND",
          message: `Tool '${toolName}' not found`,
        },
      },
      404
    );
  }

  // Check scopes
  const userScopes = context.scopes || [];
  if (!hasRequiredScopes(userScopes, tool.requiredScopes)) {
    return c.json(
      {
        ok: false,
        error: {
          code: "SCOPE_MISSING",
          message: `Missing required scopes: ${tool.requiredScopes.join(", ")}`,
          required: tool.requiredScopes,
          provided: userScopes,
        },
      },
      403
    );
  }

  // Get domain target (service binding preferred)
  const domainFetcher = getDomainFetcher(tool.domain, env);
  const domainUrl = getDomainUrl(tool.domain, env);
  if (!domainFetcher && !domainUrl) {
    return c.json(
      {
        ok: false,
        error: {
          code: "UPSTREAM_ERROR",
          message: `Domain ${tool.domain} target not configured`,
        },
      },
      500
    );
  }

  // Call remote endpoint
  const secret = env.DOMAIN_SHARED_SECRET;
  if (!secret) {
    return c.json(
      {
        ok: false,
        error: {
          code: "UPSTREAM_ERROR",
          message: "Gateway secret not configured",
        },
      },
      500
    );
  }

  const rpcResponse = await callRemoteToolEndpoint(
    domainUrl,
    domainFetcher,
    toolName,
    toolInput,
    context,
    secret
  );

  if (!rpcResponse.ok) {
    return c.json({
      ok: false,
      error: rpcResponse.error,
    });
  }

  return c.json({
    ok: true,
    data: rpcResponse.data,
    context: {
      request_id: context.request_id,
      tenant_id: context.tenant_id,
      actor_id: context.actor_id,
    },
  });
});

// ============================================================================
// Health & Info
// ============================================================================

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "MCP Gateway",
    timestamp: new Date().toISOString(),
  });
});

app.get("/", (c) => {
  const domainAUrl = (c.env as any).DOMAIN_A_URL;
  const domainBUrl = (c.env as any).DOMAIN_B_URL;
  const hasDomainAService = Boolean((c.env as any).DOMAIN_A_SERVICE);
  const hasDomainBService = Boolean((c.env as any).DOMAIN_B_SERVICE);

  return c.json({
    service: "MCP Gateway Worker",
    mcpEndpoint: "/mcp",
    restEndpoints: {
      listTools: "GET /tools",
      callTool: "POST /tools/:name/call",
    },
    domains: {
      A: domainAUrl,
      B: domainBUrl,
    },
    serviceBindings: {
      A: hasDomainAService,
      B: hasDomainBService,
    },
    toolCount: getAllTools().length,
  });
});

export default app;
