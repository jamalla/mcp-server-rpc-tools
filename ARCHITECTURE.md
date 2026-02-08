# ARCHITECTURE DOCUMENTATION

Complete system design and data flow diagrams.

## System Architecture Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                      MCP CLIENT LAYER                              │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────────────────────┐      ┌──────────────────────┐            │
│  │  Streamlit Web UI    │      │  Claude AI /        │            │
│  │  (Python)           │      │  Other MCP Clients   │            │
│  └──────────┬───────────┘      └──────────┬───────────┘            │
│             │ HTTP/REST                   │ MCP JSON-RPC            │
└─────────────┼───────────────────────────────┼────────────────────────┘
              │                               │
              └───────────────────┬───────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │   MCP Gateway Worker      │
                    │  (Cloudflare + Hono)      │
                    │                           │
                    │  • Tool Registry          │
                    │  • Scope Validation       │
                    │  • Origin Allowlist       │
                    │  • Request Routing        │
                    │  • Error Handling         │
                    └──────┬──────────┬──────────┘
                           │          │
              ┌────────────┘          └────────────┐
              │                                    │
    ┌─────────▼──────────────┐        ┌──────────▼──────────────┐
    │ Domain A RPC Worker    │        │ Domain B RPC Worker    │
    │ (Cloudflare + Hono)    │        │ (Cloudflare + Hono)   │
    │                        │        │                        │
    │ • hello                │        │ • sum                  │
    │ • list-top-customers   │        │ • normalize-text       │
    │                        │        │                        │
    │ Token: gateway-auth    │        │ Token: gateway-auth    │
    └────────────────────────┘        └────────────────────────┘
```

## Request Flow Diagrams

### Flow 1: Tool Discovery (tools/list)

```
┌────────────┐
│MCP Client  │
│(Streamlit) │
└──────┬─────┘
       │ GET /tools
       │ x-scopes: read:greetings,...
       │
       ▼
┌──────────────────────────┐     ┌─────────────────────────┐
│  MCP Gateway             │────▶│ Tool Registry           │
│                          │     │                         │
│ 1. Parse x-scopes header │     │ {                       │
│ 2. Look up tools locally │◀────│   hello: {...},         │
│ 3. Return tool metadata  │     │   list-top-customers:...│
└──────────────────────────┘     │   sum: {...}            │
       |                         │   normalize-text: {...} │
       | [4 tools]              │ }                         │
       ▼                         └─────────────────────────┘
┌────────────┐
│MCP Client  │
│ Tools[]    │
└────────────┘
```

**Response (200):**
```json
{
  "ok": true,
  "data": {
    "tools": [
      {
        "name": "hello",
        "description": "...",
        "inputSchema": {...},
        "requiredScopes": ["read:greetings"]
      },
      ...4 tools total
    ]
  }
}
```

### Flow 2: Tool Execution with Scope Check

```
┌────────────┐
│MCP Client  │
│(Streamlit) │
└──────┬─────┘
       │ POST /tools/list-top-customers/call
       │ x-scopes: customers:read
       │ Body: { arguments: { limit: 3 } }
       │
       ▼
┌────────────────────────────┐
│ MCP Gateway                │
│                            │
│ 1. Extract scopes          │
│    [customers:read]        │
│                            │
│ 2. Find tool               │
│    list-top-customers      │
│                            │
│ 3. Check required scopes   │
│    [customers:read]        │
│                            │
│ 4. Compare:                │
│    [customers:read] ⊆      │
│    [customers:read] ✅     │
│                            │
│ 5. Build RPC request       │
└──────┬─────────────────────┘
       │ POST /tools/list-top-customers/invoke
       │ x-gateway-token: dev-secret-123
       │ Body: {
       │   input: { limit: 3 },
       │   context: {
       │     scopes: ["customers:read"],
       │     request_id: "uuid",
       │     tenant_id: "...",
       │     actor_id: "..."
       │   }
       │ }
       │
       ▼
┌──────────────────────────┐
│ Domain A Worker          │
│                          │
│ 1. Validate token        │
│ 2. Parse input           │
│ 3. Call listTopCustomers │
│ 4. Return mock data      │
└──────┬───────────────────┘
       │ 200 OK
       │ {
       │   ok: true,
       │   data: [
       │     {id, name, total_spent},
       │     {id, name, total_spent},
       │     {id, name, total_spent}
       │   ]
       │ }
       │
       ▼
┌─────────────────────────────┐
│ MCP Gateway                 │
│ Wraps response in MCP format│
└──────┬──────────────────────┘
       │ 200 OK
       │ {
       │   ok: true,
       │   data: [...customers],
       │   context: {
       │     request_id: "uuid"
       │   }
       │ }
       │
       ▼
┌────────────┐
│MCP Client  │
│ Displays in│
│  Streamlit │
└────────────┘
```

### Flow 3: Scope Rejection

```
┌────────────┐
│MCP Client  │
└──────┬─────┘
       │ POST /tools/list-top-customers/call
       │ x-scopes: read:greetings    ← Wrong scope!
       │
       ▼
┌────────────────────────────┐
│ MCP Gateway                │
│                            │
│ 1. Extract scopes          │
│    [read:greetings]        │
│                            │
│ 2. Find tool               │
│    list-top-customers      │
│                            │
│ 3. Check required scopes   │
│    [customers:read]        │
│                            │
│ 4. Compare:                │
│    [customers:read] ⊆      │
│    [read:greetings]        │
│    ✗ NOT FOUND             │
│                            │
│ 5. Return error (no RPC)   │
└──────┬─────────────────────┘
       │ 403 FORBIDDEN
       │ {
       │   ok: false,
       │   error: {
       │     code: "SCOPE_MISSING",
       │     message: "Missing required scopes: customers:read",
       │     required: ["customers:read"],
       │     provided: ["read:greetings"]
       │   }
       │ }
       │
       ▼
┌────────────┐
│MCP Client  │
│ Shows error│
└────────────┘
```

## Data Structures

### MCP Request (JSON-RPC 2.0)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call|tools/list",
  "params": {
    "name": "tool_name",
    "arguments": {
      "param1": "value1",
      "param2": "value2"
    }
  }
}
```

### MCP Response (Success)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text|image|resource|error",
        "text": "..."
      }
    ]
  }
}
```

### MCP Response (Error)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32600,  // Standard JSON-RPC error codes
    "message": "Invalid Request",
    "data": {
      "code": "TOOL_NOT_FOUND",  // Custom error code
      "message": "Tool 'xyz' not found"
    }
  }
}
```

### RPC Request (Gateway → Domain)

```json
{
  "input": {
    "name": "Alice"
  },
  "context": {
    "tenant_id": "acme",
    "actor_id": "user_123",
    "scopes": ["read:greetings"],
    "request_id": "550e8400-e29b-41d4"
  }
}
```

### RPC Response (Domain → Gateway)

**Success:**
```json
{
  "ok": true,
  "data": {
    "message": "Hello, Alice!"
  }
}
```

**Error:**
```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Tool input validation failed",
    "details": [
      {
        "path": ["limit"],
        "message": "Number must be less than or equal to 50"
      }
    ]
  }
}
```

## Scope System

### Scope Definition

A scope represents a permission or capability. Format: `resource:action`

**Available Scopes:**

| Scope | Tool | Action |
|-------|------|--------|
| `read:greetings` | hello | Read greeting engine |
| `customers:read` | list-top-customers | Read customer data |
| `math:execute` | sum | Execute math operations |
| `text:transform` | normalize-text | Transform text |

### Scope Enforcement Algorithm

```
FOR EACH tool_call:
  1. Extract user_scopes from x-scopes header
     → ["customers:read", "math:execute"]
  
  2. Look up tool definition
     → list-top-customers requires ["customers:read"]
  
  3. Check if all required scopes present
     → required ⊆ user_scopes?
  
  4. If YES
     → Execute tool, return result
  
  5. If NO
     → Reject (403), return SCOPE_MISSING error
```

### Scope Example Sequence

```
Request 1:
x-scopes: read:greetings,customers:read
Tool: hello (requires read:greetings)
→ ✅ ALLOWED

Request 2:
x-scopes: read:greetings,customers:read
Tool: list-top-customers (requires customers:read)
→ ✅ ALLOWED

Request 3:
x-scopes: read:greetings
Tool: list-top-customers (requires customers:read)
→ ❌ SCOPE_MISSING (403)

Request 4:
x-scopes: math:execute,text:transform
Tool: sum (requires math:execute)
→ ✅ ALLOWED
```

## Token & Secret Flow

### Shared Secret Management

```
Setup Phase:
┌─────────────────────────────────────┐
│ Administrator                       │
│ Generates: dev-secret-123           │
└────────────┬────────────────────────┘
             │
    ┌────────┼────────┬────────┐
    │        │        │        │
    ▼        ▼        ▼        ▼
┌─────┐  ┌─────┐  ┌─────┐  (Dev only)
│ A   │  │ B   │  │Gate │
│ sec │  │ sec │  │ way │
└─────┘  └─────┘  └─────┘
```

### Deployment Phase

```
Production:
┌────────────────────────────────┐
│ Admin generates 2 secrets:      │
│ • prod-secret-a: Domain A & B   │
│ • prod-secret-b: Domain A & B   │
└────────────────────────────────┘
         │
    ┌────┼────┬─────────┐
    │    │    │         │
    ▼    ▼    ▼         ▼
[Secret Manager] (Cloudflare KV / 1Password / etc)

Each Worker reads its secret:
Domain A: wrangler secret (stored securely)
Domain B: wrangler secret (same value)
Gateway:  wrangler secret (same value)
```

### Runtime Flow

```
Gateway → Domain Request:

headers: {
  "x-gateway-token": "dev-secret-123"
}

Domain Worker:
1. Read env.DOMAIN_SHARED_SECRET
2. Compare header vs env
3. If match → Process request
4. If mismatch → 403 FORBIDDEN
```

## Context Propagation

```
Initial Request (Client):
┌────────────────────────────┐
│ POST /tools/hello/call     │
│ Headers:                   │
│   x-tenant-id: acme        │
│   x-actor-id: alice@example│
│   x-scopes: read:greetings │
└────────────────────────────┘
          │
          ▼
    ┌─────────────────────────────────┐
    │ Gateway builds context          │
    │ {                               │
    │   tenant_id: "acme",            │
    │   actor_id: "alice@example",    │
    │   scopes: ["read:greetings"],   │
    │   request_id: "uuid-generated"  │
    │ }                               │
    └────────────┬────────────────────┘
                 │
                 ▼
    ┌─────────────────────────────────┐
    │ RPC Call to Domain A             │
    │ {                               │
    │   input: { name: "..." },       │
    │   context: { ... }              │
    │ }                               │
    │                                 │
    │ Domain A can:                   │
    │ • Log request_id for tracing    │
    │ • Record actor_id for audit     │
    │ • Use tenant_id for multi-tenancy
    │ • Check scopes if needed        │
    └─────────────────────────────────┘
```

## Error Handling Flow

```
┌────────────────────────────────────────┐
│ Request arrives at Gateway             │
└────────────┬───────────────────────────┘
             │
             ▼
    ┌────────────────────────┐
    │ Validate scope         │
    └───────┬────────────────┘
            │
       ┌────┴─────┐
       │           │
    Missing?    Present?
       │           │
       ▼           ▼
    403 ────→  ┌─────────────────┐
    ERROR      │ Build RPC call  │
               │ to domain       │
               └────────┬────────┘
                        │
                        ▼
                   ┌──────────────────┐
                   │ Domain processes │
                   └────────┬─────────┘
                            │
                       ┌────┴──────┐
                       │           │
                   Success?    Error?
                       │           │
                       ▼           ▼
                    200 ────→   error_response
                    data        {
                                  ok: false,
                                  error: {...}
                                }
                                │
                                ▼
                            ┌──────────────────┐
                            │ Gateway wraps    │
                            │ in response      │
                            └────────┬─────────┘
                                     │
                                     ▼
                            ┌──────────────────┐
                            │ Response to      │
                            │ client           │
                            └──────────────────┘
```

## Deployment Architecture

### Local Development

```
Developer Machine:
├── Port 8001: Domain A Worker (wrangler dev)
├── Port 8002: Domain B Worker (wrangler dev)
├── Port 8000: Gateway Worker (wrangler dev)
└── Port 8501: Streamlit Client (streamlit run)

All communicate over localhost:port
No secrets on disk (wrangler handles securely)
```

### Production

```
Cloudflare Workers:
├── domain-a-<hash>.workers.dev (Deployed)
├── domain-b-<hash>.workers.dev (Deployed)
└── mcp-gateway-<hash>.workers.dev (Deployed)

Communication:
├── Gateway → Domain A via HTTPS
├── Gateway → Domain B via HTTPS
└── Public API: https://mcp-gateway-<hash>.workers.dev

Secrets:
├── Each worker has own DOMAIN_SHARED_SECRET
├── Stored in Cloudflare KV or Secrets Manager
└── Never exposed in logs or responses
```

## Scaling Considerations

### Add More Tools

1. Create new domain worker (domain-c-tools-worker)
2. Implement tool handlers
3. Add tools to gateway registry
4. Redeploy gateway

### Add More Scopes

1. Define scope in registry (e.g., `admin:execute`)
2. Assign to tools requiring it
3. Clients send scope in header
4. Gateway validates

### Add More Domains

```
Current:
Gateway → [Domain A, Domain B]

Future:
Gateway → [Domain A, Domain B, Domain C, Domain D, ...]
```

Just add entries to registry and domain URLs to wrangler.toml.

### Multi-Tenant

Context already supports `tenant_id`:

```json
{
  "context": {
    "tenant_id": "tenant-123",  ← Use this for sharding
    "actor_id": "user-456",
    "scopes": ["customers:read"]
  }
}
```

Domain workers can use tenant_id to:
- Route to tenant-specific databases
- Filter data by tenant
- Log tenant_id in audit trail

---

## Sequence Diagrams

### Complete Happy Path

```
Client    Gateway    Domain A    Domain B
  │          │           │          │
  │ tools/list           │          │
  ├─────────────────────→│          │
  │                      │          │
  │        [4 tools]     │          │
  │←─────────────────────┤          │
  │                      │          │
  │ call: hello          │          │
  ├─────────────────────→│          │
  │                  ┌─ scope check
  │                  │ POST /tools/hello/invoke
  │                  ├────────────────────────→
  │                  │      [response]
  │                  │←────────────────────────
  │       [result]   │
  │←─────────────────┤
  │                  │
  │ call: sum        │  (Domain B)
  ├─────────────────→│───────────────────────→ sum tool
  │                  │                         │
  │                  │        [15]            │
  │                  │←────────────────────────
  │      [result]    │
  │←─────────────────┤
```

---

**Last Updated:** February 2026
