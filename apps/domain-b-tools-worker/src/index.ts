import { Hono } from "hono";
import { z } from "zod";
import {
  SumToolInputSchema,
  NormalizeTextToolInputSchema,
  RPCRequestSchema,
  type RPCResponse,
} from "./types";

const app = new Hono();

// Helper: Title case conversion
const toTitleCase = (text: string): string => {
  return text
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

// Tool: sum
const sumTool = async (input: any): Promise<any> => {
  const parsed = SumToolInputSchema.parse(input);
  return {
    result: parsed.a + parsed.b,
    a: parsed.a,
    b: parsed.b,
  };
};

// Tool: normalize-text
const normalizeTextTool = async (input: any): Promise<any> => {
  const parsed = NormalizeTextToolInputSchema.parse(input);
  let result: string;

  switch (parsed.mode) {
    case "lower":
      result = parsed.text.toLowerCase();
      break;
    case "upper":
      result = parsed.text.toUpperCase();
      break;
    case "title":
      result = toTitleCase(parsed.text);
      break;
  }

  return {
    result,
    original: parsed.text,
    mode: parsed.mode,
  };
};

// Route: POST /tools/:toolName/invoke
app.post("/tools/:toolName/invoke", async (c) => {
  const secret = (c.env as any)?.DOMAIN_SHARED_SECRET;

  // Validate token
  const token = c.req.header("x-gateway-token");
  if (token !== secret) {
    return c.json(
      {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Invalid or missing gateway token",
        },
      } as RPCResponse,
      403
    );
  }

  const toolName = c.req.param("toolName");

  try {
    // Parse request body
    const body = await c.req.json();
    const rpcRequest = RPCRequestSchema.parse(body);

    let result: any;

    // Route to tool
    if (toolName === "sum") {
      result = await sumTool(rpcRequest.input);
    } else if (toolName === "normalize-text") {
      result = await normalizeTextTool(rpcRequest.input);
    } else {
      return c.json(
        {
          ok: false,
          error: {
            code: "TOOL_NOT_FOUND",
            message: `Tool '${toolName}' not found in Domain B`,
          },
        } as RPCResponse,
        404
      );
    }

    return c.json({
      ok: true,
      data: result,
    } as RPCResponse);
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return c.json(
        {
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Tool input validation failed",
            details: error.errors,
          },
        } as RPCResponse,
        400
      );
    }

    // Handle unexpected errors
    console.error(`Error calling tool ${toolName}:`, error);
    return c.json(
      {
        ok: false,
        error: {
          code: "UPSTREAM_ERROR",
          message: "Failed to execute tool",
          details: error instanceof Error ? error.message : String(error),
        },
      } as RPCResponse,
      500
    );
  }
});

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok", domain: "B", timestamp: new Date().toISOString() });
});

// Root
app.get("/", (c) => {
  return c.json({
    service: "Domain B Tools Worker",
    tools: ["sum", "normalize-text"],
    rpc_endpoint: "/tools/:toolName/invoke",
  });
});

export default app;
