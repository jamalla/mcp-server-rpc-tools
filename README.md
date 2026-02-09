# MCP Server + RPC Tools Monorepo

A complete end-to-end demo system showcasing **Cloudflare Workers + Hono + MCP (Model Context Protocol)** as a monorepo using PNPM workspaces.

## Live Demo

Try the live Streamlit client here:
https://mcp-server-rpc-tools-gzlapy2fedh6ff2wohnnhl.streamlit.app/

## Architecture

- **mcp-gateway-worker**: MCP server entrypoint that routes tool calls to domain workers via secure RPC
- **domain-a-tools-worker**: RPC endpoint exposing Domain A tools (hello, list-top-customers)
- **domain-b-tools-worker**: RPC endpoint exposing Domain B tools (sum, normalize-text)
- **mcp-client-streamlit**: Python UI for testing the MCP gateway

## Quick Start

### Prerequisites
- Node.js 18+
- PNPM 8+
- Wrangler CLI: `npm install -g wrangler`
- Python 3.9+ (for Streamlit app)

### Setup Order

**1. Install Dependencies**
```bash
pnpm install
```

**2. Deploy Domain Workers First**

Configure and deploy domain-a-tools-worker:
```bash
cd apps/domain-a-tools-worker
wrangler secret put DOMAIN_SHARED_SECRET
# Enter a shared secret (e.g., "dev-secret-123")
```

Deploy:
```bash
pnpm deploy:domain-a
```

Then domain-b-tools-worker:
```bash
cd ../domain-b-tools-worker
wrangler secret put DOMAIN_SHARED_SECRET
# Use same secret
pnpm deploy:domain-b
```

**3. Get Deployed URLs**

After successful deployments, note the URLs:
- Domain A: `https://domain-a-<unique>.workers.dev`
- Domain B: `https://domain-b-<unique>.workers.dev`

**4. Configure & Deploy Gateway**

Update `apps/mcp-gateway-worker/wrangler.toml`:
```toml
[env.production]
vars = { DOMAIN_A_URL = "https://domain-a-<unique>.workers.dev", DOMAIN_B_URL = "https://domain-b-<unique>.workers.dev", ALLOWED_ORIGINS = "localhost:3000,localhost:8501" }
```

Deploy gateway:
```bash
cd apps/mcp-gateway-worker
wrangler secret put DOMAIN_SHARED_SECRET
# Use same secret
pnpm deploy:gateway
```

Gateway URL: `https://mcp-gateway-<unique>.workers.dev`

**5. Run Streamlit Client**

```bash
cd apps/mcp-client-streamlit
pip install -r requirements.txt
streamlit run app.py
```

Open browser to `http://localhost:8501`, set MCP URL to the gateway URL + `/mcp`.

## Local Development

All three Workers can run in local dev mode simultaneously:

```bash
# Terminal 1
pnpm dev:domain-a

# Terminal 2
pnpm dev:domain-b

# Terminal 3
pnpm dev:gateway

# Terminal 4 (after Workers are running)
cd apps/mcp-client-streamlit
streamlit run app.py
```

Default local URLs:
- Domain A: http://localhost:8001
- Domain B: http://localhost:8002
- Gateway: http://localhost:8000
- Streamlit: http://localhost:8501

## Project Structure

```
repo-root/
├── apps/
│   ├── mcp-gateway-worker/          # MCP server endpoint
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── registry.ts
│   │   │   └── types.ts
│   │   ├── package.json
│   │   ├── wrangler.toml
│   │   └── tsconfig.json
│   ├── domain-a-tools-worker/       # Domain A RPC tools
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   └── types.ts
│   │   ├── package.json
│   │   ├── wrangler.toml
│   │   └── tsconfig.json
│   ├── domain-b-tools-worker/       # Domain B RPC tools
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   └── types.ts
│   │   ├── package.json
│   │   ├── wrangler.toml
│   │   └── tsconfig.json
│   └── mcp-client-streamlit/        # Python Streamlit client
│       ├── app.py
│       └── requirements.txt
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

## Testing Checklist

After deployment, verify the system:

- [ ] **tools/list**: Returns all 4 tools (2 from Domain A, 2 from Domain B)
- [ ] **hello**: Accepts `{ name: string }`, returns greeting message
- [ ] **list-top-customers**: Accepts `{ limit: number }`, returns mock customer data
- [ ] **sum**: Accepts `{ a: number, b: number }`, returns sum result
- [ ] **normalize-text**: Accepts `{ text, mode: "lower"|"upper"|"title" }`, returns normalized text
- [ ] **Scope validation**: Request with missing `customers:read` header fails for list-top-customers
- [ ] **Origin validation**: Request from unlisted origin is blocked
- [ ] **Token validation**: RPC call without correct gateway token returns 403

## Available Scripts

```bash
# Development
pnpm dev:gateway        # Start gateway in local dev mode
pnpm dev:domain-a       # Start domain A in local dev mode
pnpm dev:domain-b       # Start domain B in local dev mode
pnpm dev:all           # Start all Workers in parallel

# Production Deployment
pnpm deploy:gateway     # Deploy gateway to Cloudflare
pnpm deploy:domain-a    # Deploy domain A to Cloudflare
pnpm deploy:domain-b    # Deploy domain B to Cloudflare
pnpm deploy:all        # Deploy all (domains first, then gateway)

# Build
pnpm build             # Build all projects
```

## Security Notes

- **Shared Secret**: `DOMAIN_SHARED_SECRET` is a simple shared token between gateway and domain workers (not production-grade; use mTLS in production)
- **Origin Allowlist**: Configured via `ALLOWED_ORIGINS` in gateway wrangler.toml
- **Scope Enforcement**: Incoming `x-scopes` header is validated against tool requirements
- **Secrets Management**: Never commit secrets; use `wrangler secret` to store them

## MCP Specification

The gateway exposes a standard MCP 1.0 server at `/mcp` using streaming HTTP transport.

Two primary RPC methods:
1. **tools/list**: Discover available tools
2. **tools/call**: Execute a tool with input validation and scope checking

See individual app READMEs for detailed integration examples.

## Troubleshooting

**"DOMAIN_A_URL is not configured"**
- Update wrangler.toml in mcp-gateway-worker with deployed domain URLs
- Redeploy gateway: `pnpm deploy:gateway`

**401 Unauthorized on domain workers**
- Verify `DOMAIN_SHARED_SECRET` is set and identical on all workers
- Check `x-gateway-token` header is included in gateway → domain RPC calls

**CORS errors from Streamlit**
- Ensure gateway URL is in `ALLOWED_ORIGINS` in wrangler.toml
- Test with curl first before using Streamlit

**Scope rejection errors**
- Pass `x-scopes: customers:read,data:read` header in Streamlit UI
- Check tool definitions in registry for required scopes

## License

MIT
