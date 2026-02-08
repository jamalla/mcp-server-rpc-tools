# Domain B Tools Worker

**Domain B Tools Worker** — RPC endpoint for Domain B tools.

## Overview

Simple Cloudflare Worker running Hono that exposes two tools via JSON-RPC:
1. **sum** - Calculates sum of two numbers (requires: `math:execute` scope)
2. **normalize-text** - Normalizes text case (requires: `text:transform` scope)

## Architecture

```
┌─────────────┐
│   Gateway   │  (via /mcp endpoint)
├─────────────┤
│   Calls →   │
└─────────────┘
       ↓
┌──────────────────────────┐
│  Domain B: RPC Endpoint  │
├──────────────────────────┤
│  POST /tools/:name/invoke│
├──────────────────────────┤
│  - sum                    │
│  - normalize-text         │
└──────────────────────────┘
```

## File Structure

```
domain-b-tools-worker/
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
cd apps/domain-b-tools-worker
pnpm install
```

### 2. Configure Secrets

Store the shared secret (must match Domain A):

```bash
wrangler secret put DOMAIN_SHARED_SECRET
# Paste: dev-secret-123 (same as Domain A)
```

### 3. Run Locally

```bash
pnpm dev
```

The worker starts on `http://localhost:8002`.

Test health:
```bash
curl http://localhost:8002/health
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
    "a": 5,
    "b": 3
  },
  "context": {
    "tenant_id": "acme",
    "actor_id": "user_123",
    "scopes": ["math:execute"],
    "request_id": "req_456"
  }
}
```

### Response (Success)

```json
{
  "ok": true,
  "data": {
    "result": 8,
    "a": 5,
    "b": 3
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

### 1. sum

**Description:** Calculates the sum of two numbers.

**Requires Scope:** `math:execute`

**Input:**
```json
{
  "a": "number (required)",
  "b": "number (required)"
}
```

**Output:**
```json
{
  "result": 8,
  "a": 5,
  "b": 3
}
```

**Example:**
```bash
curl -X POST http://localhost:8002/tools/sum/invoke \
  -H "x-gateway-token: dev-secret-123" \
  -H "Content-Type: application/json" \
  -d '{
    "input": { "a": 5, "b": 3 },
    "context": { "scopes": ["math:execute"] }
  }'
```

### 2. normalize-text

**Description:** Normalizes text to different cases.

**Requires Scope:** `text:transform`

**Input:**
```json
{
  "text": "string (required)",
  "mode": "lower|upper|title (required)"
}
```

**Output:**
```json
{
  "result": "hello world",
  "original": "Hello World",
  "mode": "lower"
}
```

**Example:**
```bash
curl -X POST http://localhost:8002/tools/normalize-text/invoke \
  -H "x-gateway-token: dev-secret-123" \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "text": "Hello World",
      "mode": "lower"
    },
    "context": { "scopes": ["text:transform"] }
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
bash ./test-domain-b.sh
```

Or manually:

```bash
# Test sum tool
curl -X POST http://localhost:8002/tools/sum/invoke \
  -H "x-gateway-token: dev-secret-123" \
  -H "Content-Type: application/json" \
  -d '{
    "input": { "a": 10, "b": 20 },
    "context": { "scopes": ["math:execute"] }
  }'

# Test normalize-text (lower)
curl -X POST http://localhost:8002/tools/normalize-text/invoke \
  -H "x-gateway-token: dev-secret-123" \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "text": "Hello World",
      "mode": "lower"
    },
    "context": { "scopes": ["text:transform"] }
  }'

# Test normalize-text (upper)
curl -X POST http://localhost:8002/tools/normalize-text/invoke \
  -H "x-gateway-token: dev-secret-123" \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "text": "hello world",
      "mode": "upper"
    },
    "context": { "scopes": ["text:transform"] }
  }'

# Test normalize-text (title)
curl -X POST http://localhost:8002/tools/normalize-text/invoke \
  -H "x-gateway-token: dev-secret-123" \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "text": "hello world example",
      "mode": "title"
    },
    "context": { "scopes": ["text:transform"] }
  }'

# Test without token (should fail 403)
curl -X POST http://localhost:8002/tools/sum/invoke \
  -H "Content-Type: application/json" \
  -d '{"input": {"a": 1, "b": 2}}'

# Test invalid tool (should fail 404)
curl -X POST http://localhost:8002/tools/invalid-tool/invoke \
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
# https://domain-b-<hash>.workers.dev
```

After deployment, update the gateway's `wrangler.toml` with this URL in the `DOMAIN_B_URL` variable.

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
