import { z } from "zod";

// Standard RPC Contract Types

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

// Tool-specific schemas

export const SumToolInputSchema = z.object({
  a: z.number(),
  b: z.number(),
});

export type SumToolInput = z.infer<typeof SumToolInputSchema>;

export const NormalizeTextToolInputSchema = z.object({
  text: z.string(),
  mode: z.enum(["lower", "upper", "title"]),
});

export type NormalizeTextToolInput = z.infer<typeof NormalizeTextToolInputSchema>;
