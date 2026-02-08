import { type ToolDefinition, type ToolRegistry } from "./types";

/**
 * Tool Registry: Defines all available tools from both domains.
 * Each tool includes metadata, input schema, and scope requirements.
 */
export const toolRegistry: ToolRegistry = {
  // Domain A Tools
  hello: {
    name: "hello",
    description:
      "Generates a greeting message. Accepts an optional name parameter.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name to greet (optional, defaults to 'World')",
        },
      },
    },
    requiredScopes: ["read:greetings"],
    domain: "A",
  },

  "list-top-customers": {
    name: "list-top-customers",
    description:
      "Returns top customers by spending. Requires customer read scope.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "integer",
          description: "Number of customers to return (1-50, default 5)",
          minimum: 1,
          maximum: 50,
        },
      },
    },
    requiredScopes: ["customers:read"],
    domain: "A",
  },

  // Domain B Tools
  sum: {
    name: "sum",
    description: "Calculates the sum of two numbers.",
    inputSchema: {
      type: "object",
      properties: {
        a: {
          type: "number",
          description: "First number",
        },
        b: {
          type: "number",
          description: "Second number",
        },
      },
      required: ["a", "b"],
    },
    requiredScopes: ["math:execute"],
    domain: "B",
  },

  "normalize-text": {
    name: "normalize-text",
    description:
      "Normalizes text to lower, upper, or title case.",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Text to normalize",
        },
        mode: {
          type: "string",
          enum: ["lower", "upper", "title"],
          description: "Normalization mode",
        },
      },
      required: ["text", "mode"],
    },
    requiredScopes: ["text:transform"],
    domain: "B",
  },
};

/**
 * Get all tools available in the registry
 */
export const getAllTools = () => {
  return Object.values(toolRegistry);
};

/**
 * Get tool by name
 */
export const getToolByName = (name: string): ToolDefinition | null => {
  return toolRegistry[name] || null;
};

/**
 * Check if user has required scopes for a tool
 */
export const hasRequiredScopes = (
  userScopes: string[],
  requiredScopes: string[]
): boolean => {
  if (requiredScopes.length === 0) return true;
  return requiredScopes.every((scope) => userScopes.includes(scope));
};

/**
 * Get RPC endpoint URL for a tool's domain
 */
export const getDomainUrl = (
  domain: "A" | "B",
  env: any
): string | null => {
  if (domain === "A") {
    return env.DOMAIN_A_URL;
  } else if (domain === "B") {
    return env.DOMAIN_B_URL;
  }
  return null;
};
