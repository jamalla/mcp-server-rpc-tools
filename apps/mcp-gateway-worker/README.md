# MCP Gateway Worker

**MCP Gateway Worker** — Central MCP server that routes tool calls to domain-specific RPC workers.

## Overview

This is the heart of the system. It:
- Exposes an **MCP 1.0 server** at `/mcp` endpoint
- Maintains a **tool registry** combining tools from both domains
- Validates **scopes** and **origins**
- Routes tool calls to **remote RPC endpoints** with secure token-based auth
- Returns consistent error payloads in MCP format

## Architecture

```
┌─────────────────────────────────────┐
│     MCP Clients (Streamlit, etc)    │
└────────────┬────────────────────────┘
             │
             ↓ (MCP JSON-RPC at /mcp)
             
┌──────────────────────────────────────┐
│   MCP Gateway Worker                 │
├──────────────────────────────────────┤
│  - Tool Registry (4 tools total)     │
│  - Scope Validation                  │
│  - Origin Allowlist                  │
│  - Request ID Tracking               │
└────────┬──────────────────┬──────────┘
         │                  │
         ↓                  ↓
    ┌─────────────┐    ┌─────────────┐
    │  Domain A   │    │  Domain B   │
    │  RPC Worker │    │  RPC Worker │
    │ (hello, etc)│    │  (sum, etc) │
    └─────────────┘    └─────────────┘
```

## File Structure

```
mcp-gateway-worker/
├── src/
│   ├── index.ts           # Main MCP server + routing logic
│   ├── registry.ts        # Tool definitions & registry functions
│   └── types.ts           # TypeScript types & zod schemas
├── package.json           # Dependencies
├── wrangler.toml          # Wrangler config (with env vars)
├── tsconfig.json          # TypeScript config
└── README.md              # This file
```

## Setup

### 1. Install Dependencies
```bash
cd apps/mcp-gateway-worker
pnpm install
```

### 2. Configure Environment Variables

Edit `wrangler.toml` and set domain URLs. For local dev:

```toml
[vars]
ENVIRONMENT = "development"
DOMAIN_A_URL = "http://localhost:8001"
DOMAIN_B_URL = "http://localhost:8002"
ALLOWED_ORIGINS = "localhost:8000,localhost:8501"
```

### 3. Configure Secrets

```bash
wrangler secret put DOMAIN_SHARED_SECRET
# Paste: dev-secret-123 (must match domains)
```

### 4. Run Locally

Make sure domain workers are running first:

```bash
# Terminal 1: Domain A
cd apps/domain-a-tools-worker && pnpm dev

# Terminal 2: Domain B
cd apps/domain-b-tools-worker && pnpm dev

# Terminal 3: Gateway
cd apps/mcp-gateway-worker && pnpm dev
```

Gateway starts on `http://localhost:8000`.

Test health:
```bash
curl http://localhost:8000/health
```

## API Endpoints

### MCP Endpoint: POST /mcp

The main MCP 1.0 server endpoint using JSON-RPC 2.0.

**Headers:**
```
Content-Type: application/json
x-scopes: read:greetings,customers:read,math:execute,text:transform
x-tenant-id: optional_tenant_id (optional)
x-actor-id: optional_actor_id (optional)
```

#### 1. tools/list

List all available tools.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

**Response (Success):**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "hello",
        "description": "Generates a greeting message.",
        "inputSchema": { ... }
      },
      {
        "name": "list-top-customers",
        "description": "Returns top customers by spending.",
        "inputSchema": { ... }
      },
      ...
    ]
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:8000/mcp \
  -H "Content-Type: application/json" \
  -H "x-scopes: read:greetings,math:execute" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }'
```

#### 2. tools/call

Call a specific tool.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "hello",
    "arguments": {
      "name": "Alice"
    }
  }
}
```

**Response (Success):**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"message\": \"Hello, Alice! Welcome to Domain A.\"}"
      }
    ]
  }
}
```

**Response (Scope Missing):**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "error": {
    "code": -32602,
    "message": "Missing required scopes: customers:read",
    "data": {
      "code": "SCOPE_MISSING",
      "required": ["customers:read"],
      "provided": []
    }
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:8000/mcp \
  -H "Content-Type: application/json" \
  -H "x-scopes: read:greetings" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "hello",
      "arguments": { "name": "Bob" }
    }
  }'
```

### REST Endpoints (for direct testing)

#### GET /tools

List tools via REST.

```bash
curl http://localhost:8000/tools \
  -H "x-scopes: read:greetings,customers:read"
```

#### POST /tools/:name/call

Call a tool via REST (easier for Streamlit).

```bash
curl -X POST http://localhost:8000/tools/hello/call \
  -H "Content-Type: application/json" \
  -H "x-scopes: read:greetings" \
  -d '{
    "arguments": { "name": "Charlie" }
  }'
```

## Tool Registry

The gateway maintains a registry of all tools from both domains. See [src/registry.ts](src/registry.ts) for definitions.

### Tools from Domain A
- **hello** — Scope: `read:greetings`
- **list-top-customers** — Scope: `customers:read`

### Tools from Domain B
- **sum** — Scope: `math:execute`
- **normalize-text** — Scope: `text:transform`

## Scope Validation

The gateway enforces **scope-based access control**.

1. Client sends `x-scopes` header with comma-separated scopes
2. Gateway checks if client has required scopes for tool
3. If missing: returns `SCOPE_MISSING` error (403)

**Example:**

Call `list-top-customers` without `customers:read`:
```bash
curl -X POST http://localhost:8000/mcp \
  -H "Content-Type: application/json" \
  -H "x-scopes: read:greetings" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "list-top-customers",
      "arguments": { "limit": 5 }
    }
  }'

# Response: 403 with SCOPE_MISSING error
```

### Required Scopes by Tool

| Tool | Required Scope |
|------|--------|
| hello | `read:greetings` |
| list-top-customers | `customers:read` |
| sum | `math:execute` |
| normalize-text | `text:transform` |

## Origin Allowlist

The gateway checks the `Origin` header against an allowlist in `wrangler.toml`:

```toml
[vars]
ALLOWED_ORIGINS = "localhost:8000,localhost:8501,https://example.com"
```

- If `Origin` header is present and not in allowlist → 403 FORBIDDEN
- If `Origin` header is absent → request is allowed (some MCP clients don't send it)
- This allows flexible CORS without breaking non-Origin-sending clients

## Context Propagation

The gateway builds a context from request headers and passes it to domain workers:

```json
{
  "context": {
    "tenant_id": "from x-tenant-id header",
    "actor_id": "from x-actor-id header",
    "scopes": "from x-scopes header (as array)",
    "request_id": "generated UUID for tracing"
  }
}
```

This context is forwarded in every RPC call to domain workers.

## Testing

### Prerequisites

- Domain A and B workers running
- Gateway secrets configured

### Local Testing

```bash
# Terminal 1-3: Start workers
pnpm dev:all

# Terminal 4: Test endpoints
bash ./test-gateway.sh
```

Or manually:

```bash
# Test tools/list
curl -X POST http://localhost:8000/mcp \
  -H "Content-Type: application/json" \
  -H "x-scopes: read:greetings,math:execute" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }'

# Test tools/call with hello
curl -X POST http://localhost:8000/mcp \
  -H "Content-Type: application/json" \
  -H "x-scopes: read:greetings" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "hello",
      "arguments": { "name": "Dave" }
    }
  }'

# Test scope rejection (should fail)
curl -X POST http://localhost:8000/mcp \
  -H "Content-Type: application/json" \
  -H "x-scopes: read:greetings" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "list-top-customers",
      "arguments": { "limit": 5 }
    }
  }'

# Test sum tool
curl -X POST http://localhost:8000/tools/sum/call \
  -H "Content-Type: application/json" \
  -H "x-scopes: math:execute" \
  -d '{"arguments": {"a": 5, "b": 3}}'

# Test normalize-text
curl -X POST http://localhost:8000/tools/normalize-text/call \
  -H "Content-Type: application/json" \
  -H "x-scopes: text:transform" \
  -d '{"arguments": {"text": "Hello World", "mode": "lower"}}'
```

### Deployment

```bash
# Build
pnpm build

# Set production domain URLs
wrangler secret put DOMAIN_SHARED_SECRET --env production
wrangler deploy --env production

# Get your deployed URL
# https://mcp-gateway-<hash>.workers.dev
```

Then configure domain workers to this URL.

## Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| TOOL_NOT_FOUND | 404 | Tool doesn't exist |
| SCOPE_MISSING | 403 | User lacks required scopes |
| VALIDATION_ERROR | 400 | Input validation failed |
| UPSTREAM_ERROR | 500 | Domain worker error |
| FORBIDDEN | 403 | Invalid/missing token (should not occur for direct clients, only between gateway & domains) |

## Security

- **Scope-based access control:** Tools require specific scopes
- **Origin allowlist:** CORS-like checks for browser clients
- **Token-based domain auth:** Gateway uses DOMAIN_SHARED_SECRET to authenticate with domain workers
- **Input validation:** All tool inputs validated against schemas before forwarding
- **Error isolation:** Upstream errors don't leak implementation details

## License

MIT
