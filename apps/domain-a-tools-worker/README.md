import { renderMermaidDiagram } from './utils'; // Mock implementation for visualization

**Domain A Tools Worker** — RPC endpoint for Domain A tools.

## Overview

Simple Cloudflare Worker running Hono that exposes two tools via JSON-RPC:
1. **hello** - Greetings engine (requires: `read:greetings` scope)
2. **list-top-customers** - Returns mock customer data (requires: `customers:read` scope)

## Architecture

```
┌─────────────┐
│   Gateway   │  (via /mcp endpoint)
├─────────────┤
│   Calls →   │
└─────────────┘
       ↓
┌──────────────────────────┐
│  Domain A: RPC Endpoint  │
├──────────────────────────┤
│  POST /tools/:name/invoke│
├──────────────────────────┤
│  - hello                  │
│  - list-top-customers     │
└──────────────────────────┘
```

## File Structure

```
domain-a-tools-worker/
├── src/
│   ├── index.ts           # Main worker + tool handlers
│   └── types.ts           # Zod schemas and TypeScript types
├── package.json           # Dependencies
├── wrangler.toml          # Wrangler config
├── tsconfig.json          # TypeScript config
└── README.md              # This file
```

## Setup

### 1. Install Dependencies
```bash
cd apps/domain-a-tools-worker
pnpm install
```

### 2. Configure Secrets

Store the shared secret that the gateway will use:

```bash
wrangler secret put DOMAIN_SHARED_SECRET
# Paste: dev-secret-123 (or your chosen secret)
```

### 3. Run Locally

```bash
pnpm dev
```

The worker starts on `http://localhost:8001`.

Test health:
```bash
curl http://localhost:8001/health
```

## API Contract

### Request

All tool invocations use this standard RPC contract:

```json
POST /tools/:toolName/invoke

Headers:
  x-gateway-token: <DOMAIN_SHARED_SECRET>
  Content-Type: application/json

Body:
{
  "input": {
    "name": "Alice"
  },
  "context": {
    "tenant_id": "acme",
    "actor_id": "user_123",
    "scopes": ["read:greetings"],
    "request_id": "req_456"
  }
}
```

### Response (Success)

```json
{
  "ok": true,
  "data": {
    "message": "Hello, Alice! Welcome to Domain A."
  }
}
```

### Response (Error)

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Tool input validation failed",
    "details": [...]
  }
}
```

## Tools

### 1. hello

**Description:** Generates a greeting message.

**Input:**
```json
{
  "name": "string (optional, default: 'World')"
}
```

**Output:**
```json
{
  "message": "Hello, Alice! Welcome to Domain A."
}
```

**Example:**
```bash
curl -X POST http://localhost:8001/tools/hello/invoke \
  -H "x-gateway-token: dev-secret-123" \
  -H "Content-Type: application/json" \
  -d '{
    "input": { "name": "Alice" },
    "context": { "scopes": ["read:greetings"] }
  }'
```

### 2. list-top-customers

**Description:** Returns top customers by spending.

**Requires Scope:** `customers:read`

**Input:**
```json
{
  "limit": "number (1-50, optional, default: 5)"
}
```

**Output:**
```json
{
  "items": [
    {
      "id": "cust_001",
      "name": "Acme Corp",
      "total_spent": 125000
    },
    ...
  ]
}
```

**Example:**
```bash
curl -X POST http://localhost:8001/tools/list-top-customers/invoke \
  -H "x-gateway-token: dev-secret-123" \
  -H "Content-Type: application/json" \
  -d '{
    "input": { "limit": 3 },
    "context": { "scopes": ["customers:read"] }
  }'
```

## Testing

### Prerequisites

- Wrangler CLI installed
- Secret configured

### Local Testing

```bash
# Terminal 1: Start the worker
pnpm dev

# Terminal 2: Test endpoints
bash ./test-domain-a.sh
```

Or manually:

```bash
# Test hello tool
curl -X POST http://localhost:8001/tools/hello/invoke \
  -H "x-gateway-token: dev-secret-123" \
  -H "Content-Type: application/json" \
  -d '{
    "input": { "name": "Bob" },
    "context": { "scopes": ["read:greetings"] }
  }'

# Test list-top-customers
curl -X POST http://localhost:8001/tools/list-top-customers/invoke \
  -H "x-gateway-token: dev-secret-123" \
  -H "Content-Type: application/json" \
  -d '{
    "input": { "limit": 2 },
    "context": { "scopes": ["customers:read"] }
  }'

# Test without token (should fail 403)
curl -X POST http://localhost:8001/tools/hello/invoke \
  -H "Content-Type: application/json" \
  -d '{"input": {"name": "Bob"}}'

# Test invalid tool (should fail 404)
curl -X POST http://localhost:8001/tools/invalid-tool/invoke \
  -H "x-gateway-token: dev-secret-123" \
  -H "Content-Type: application/json" \
  -d '{"input": {}}'
```

### Deployment

```bash
# Build
pnpm build

# Deploy to Cloudflare Workers
pnpm deploy

# Get your deployed URL
# https://domain-a-<hash>.workers.dev
```

After deployment, update the gateway's `wrangler.toml` with this URL in the `DOMAIN_A_URL` variable.

## Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| TOOL_NOT_FOUND | 404 | Tool doesn't exist |
| VALIDATION_ERROR | 400 | Input schema validation failed |
| FORBIDDEN | 403 | Invalid or missing gateway token |
| UPSTREAM_ERROR | 500 | Internal execution error |

## Security

- **Token validation:** Every RPC call requires the `x-gateway-token` header matching `DOMAIN_SHARED_SECRET`
- **Input validation:** All inputs are validated against Zod schemas before execution
- **Error handling:** Upstream errors don't crash the worker; they return consistent error payloads

## License

MIT
