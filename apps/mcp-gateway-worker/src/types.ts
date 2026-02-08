import { z } from "zod";

// Tool Registry Types
export interface ToolInputSchema {
  [key: string]: any;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
  requiredScopes: string[];
  domain: "A" | "B";
}

export interface ToolRegistry {
  [key: string]: ToolDefinition;
}

// RPC Types
export const RPCContextSchema = z.object({
  tenant_id: z.string().optional(),
  actor_id: z.string().optional(),
  scopes: z.array(z.string()).optional(),
  request_id: z.string().optional(),
});

export type RPCContext = z.infer<typeof RPCContextSchema>;

export const RPCRequestSchema = z.object({
  input: z.record(z.any()),
  context: RPCContextSchema.optional(),
});

export type RPCRequest = z.infer<typeof RPCRequestSchema>;

export const RPCResponseSchema = z.union([
  z.object({
    ok: z.literal(true),
    data: z.record(z.any()),
  }),
  z.object({
    ok: z.literal(false),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.any().optional(),
    }),
  }),
]);

export type RPCResponse = z.infer<typeof RPCResponseSchema>;

// MCP Types
export interface MCPToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface MCPResult {
  type: "text" | "image" | "resource" | "error";
  text?: string;
  mimeType?: string;
  data?: any;
}
