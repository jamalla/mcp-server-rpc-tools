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

export const HelloToolInputSchema = z.object({
  name: z.string().optional().default("World"),
});

export type HelloToolInput = z.infer<typeof HelloToolInputSchema>;

export const ListTopCustomersToolInputSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(5),
});

export type ListTopCustomersToolInput = z.infer<
  typeof ListTopCustomersToolInputSchema
>;

// Mock customer data type
export interface Customer {
  id: string;
  name: string;
  total_spent: number;
}
