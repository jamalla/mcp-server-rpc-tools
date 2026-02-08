import { Hono } from "hono";
import { z } from "zod";
import {
  HelloToolInputSchema,
  ListTopCustomersToolInputSchema,
  RPCRequestSchema,
  type RPCResponse,
  type Customer,
} from "./types";

const app = new Hono();

// Helper: Mock customer database
const mockCustomers: Customer[] = [
  { id: "cust_001", name: "Acme Corp", total_spent: 125000 },
  { id: "cust_002", name: "TechStart Inc", total_spent: 87500 },
  { id: "cust_003", name: "Global Solutions", total_spent: 234000 },
  { id: "cust_004", name: "CloudFirst Ltd", total_spent: 156000 },
  { id: "cust_005", name: "DataPro Systems", total_spent: 198500 },
  { id: "cust_006", name: "NextGen AI", total_spent: 267000 },
];

// Tool: hello
const helloTool = async (input: any): Promise<any> => {
  const parsed = HelloToolInputSchema.parse(input);
  return {
    message: `Hello, ${parsed.name}! Welcome to Domain A.`,
  };
};

// Tool: list-top-customers
const listTopCustomersTool = async (input: any): Promise<Customer[]> => {
  const parsed = ListTopCustomersToolInputSchema.parse(input);
  return mockCustomers.slice(0, parsed.limit);
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
    if (toolName === "hello") {
      result = await helloTool(rpcRequest.input);
    } else if (toolName === "list-top-customers") {
      result = await listTopCustomersTool(rpcRequest.input);
    } else {
      return c.json(
        {
          ok: false,
          error: {
            code: "TOOL_NOT_FOUND",
            message: `Tool '${toolName}' not found in Domain A`,
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
  return c.json({ status: "ok", domain: "A", timestamp: new Date().toISOString() });
});

// Root
app.get("/", (c) => {
  return c.json({
    service: "Domain A Tools Worker",
    tools: ["hello", "list-top-customers"],
    rpc_endpoint: "/tools/:toolName/invoke",
  });
});

export default app;
