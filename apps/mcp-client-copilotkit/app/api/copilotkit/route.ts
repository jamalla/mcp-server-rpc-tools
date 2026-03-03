import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { NextRequest } from "next/server";
import OpenAI from "openai";

const gatewayUrl =
  process.env.MCP_GATEWAY_URL ?? "https://mcp-gateway-worker.to-jamz.workers.dev/mcp";

const defaultScopes =
  process.env.MCP_SCOPES ??
  "read:greetings,customers:read,math:execute,text:transform";

const defaultOpenAIModel = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const defaultOpenAIBaseUrl = process.env.OPENAI_BASE_URL;

const runtime = new CopilotRuntime({
  actions: [
    {
      name: "list_mcp_tools",
      description: "List available tools from the MCP gateway.",
      parameters: [
        {
          name: "scopes",
          type: "string",
          description: "Optional comma-separated scopes header override.",
          required: false,
        },
      ],
      handler: async ({ scopes }: { scopes?: string }) => {
        const response = await fetch(gatewayUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-scopes": scopes || defaultScopes,
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: Date.now(),
            method: "tools/list",
            params: {},
          }),
        });

        const text = await response.text();
        if (!response.ok) {
          return `Gateway error ${response.status}: ${text}`;
        }
        return text;
      },
    },
    {
      name: "call_mcp_tool",
      description:
        "Call a specific MCP tool through the live gateway. Provide tool_name and arguments_json.",
      parameters: [
        {
          name: "tool_name",
          type: "string",
          description: "Tool name from tools/list.",
          required: true,
        },
        {
          name: "arguments_json",
          type: "string",
          description: "Tool arguments as JSON string, e.g. {\"name\":\"Jamal\"}.",
          required: false,
        },
        {
          name: "scopes",
          type: "string",
          description: "Optional comma-separated scopes header override.",
          required: false,
        },
      ],
      handler: async ({
        tool_name,
        arguments_json,
        scopes,
      }: {
        tool_name: string;
        arguments_json?: string;
        scopes?: string;
      }) => {
        let parsedArguments: Record<string, unknown> = {};

        if (arguments_json?.trim()) {
          try {
            parsedArguments = JSON.parse(arguments_json);
          } catch (error) {
            return `Invalid arguments_json: ${error instanceof Error ? error.message : String(error)}`;
          }
        }

        const response = await fetch(gatewayUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-scopes": scopes || defaultScopes,
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: Date.now(),
            method: "tools/call",
            params: {
              name: tool_name,
              arguments: parsedArguments,
            },
          }),
        });

        const text = await response.text();
        if (!response.ok) {
          return `Gateway error ${response.status}: ${text}`;
        }

        return text;
      },
    },
  ],
});

export const POST = async (req: NextRequest) => {
  const requestOpenAIApiKey = req.headers.get("x-openai-api-key")?.trim();
  const envOpenAIApiKey = process.env.OPENAI_API_KEY?.trim();
  const allowEnvFallback =
    (process.env.ALLOW_ENV_OPENAI_KEY_FALLBACK ?? "false").toLowerCase() ===
    "true";
  const effectiveOpenAIApiKey = requestOpenAIApiKey
    ? requestOpenAIApiKey
    : allowEnvFallback
      ? envOpenAIApiKey
      : undefined;

  if (!effectiveOpenAIApiKey) {
    return Response.json(
      {
        error:
          "Missing OpenAI API key. Provide it in the UI field. (Env fallback is disabled by default.)",
      },
      { status: 400 },
    );
  }

  const isLikelyOpenAIKey = /^sk-(proj-)?[A-Za-z0-9_-]{16,}$/.test(
    effectiveOpenAIApiKey,
  );

  if (!isLikelyOpenAIKey) {
    return Response.json(
      {
        error:
          "Invalid OpenAI API key format. Use an OpenAI key that starts with 'sk-' (or 'sk-proj-').",
      },
      { status: 400 },
    );
  }

  const openaiClient = new OpenAI({
    apiKey: effectiveOpenAIApiKey,
    ...(defaultOpenAIBaseUrl ? { baseURL: defaultOpenAIBaseUrl } : {}),
  });

  const serviceAdapter = new OpenAIAdapter({
    model: defaultOpenAIModel,
    openai: openaiClient,
  });

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });

  return handleRequest(req);
};
