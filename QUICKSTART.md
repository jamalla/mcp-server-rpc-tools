# QUICK START GUIDE

Get the complete MCP Server + RPC Tools system running in 10 minutes.

## 1. Prerequisites (5 min)

**Install these first:**

```bash
# Node.js 18+
node --version  # Should be v18.0.0 or higher

# PNPM 8+
npm install -g pnpm
pnpm --version

# Wrangler CLI
npm install -g wrangler

# Python 3.9+
python --version

# curl (for testing)
which curl  # macOS/Linux
where curl  # Windows
```

## 2. Setup Monorepo (2 min)

```bash
# Navigate to repo
cd mcp-server-rpc-tools

# Install all dependencies
pnpm install:all

# Verify installation
pnpm -r build
```

## 3. Local Development Setup (3 min)

### Step 1: Set Shared Secret

All three workers need the same secret.

```bash
# Terminal 1: Domain A
cd apps/domain-a-tools-worker
wrangler secret put DOMAIN_SHARED_SECRET
# Paste: dev-secret-123
# Press Enter

# Terminal 2: Domain B
cd apps/domain-b-tools-worker
wrangler secret put DOMAIN_SHARED_SECRET
# Paste: dev-secret-123
# Press Enter

# Terminal 3: Gateway
cd apps/mcp-gateway-worker
wrangler secret put DOMAIN_SHARED_SECRET
# Paste: dev-secret-123
# Press Enter
```

### Step 2: Start Workers (in Parallel)

Use 4 terminals:

```bash
# Terminal 1: Domain A
cd apps/domain-a-tools-worker
pnpm dev
# Should say: ⎔ Ready on http://localhost:8001

# Terminal 2: Domain B
cd apps/domain-b-tools-worker
pnpm dev
# Should say: ⎔ Ready on http://localhost:8002

# Terminal 3: Gateway
cd apps/mcp-gateway-worker
pnpm dev
# Should say: ⎔ Ready on http://localhost:8000

# Terminal 4: Streamlit
cd apps/mcp-client-streamlit
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
streamlit run app.py
# Should open http://localhost:8501 in browser
```

**Check Health:**

```bash
# In a 5th terminal:
curl http://localhost:8000/health | jq '.'
# Should return: { "status": "ok", "service": "MCP Gateway" }
```

## 4. Quick Test (Copy-Paste Commands)

Once all workers are running:

```bash
# Test 1: List all tools
curl http://localhost:8000/tools \
  -H "x-scopes: read:greetings,customers:read,math:execute,text:transform" | jq '.'

# Should print: 4 tools (hello, list-top-customers, sum, normalize-text)

# Test 2: Call hello tool
curl -X POST http://localhost:8000/tools/hello/call \
  -H "Content-Type: application/json" \
  -H "x-scopes: read:greetings" \
  -d '{"arguments": {"name": "World"}}'

# Should print: { "ok": true, "data": { "message": "Hello, World!" } }

# Test 3: Call sum tool
curl -X POST http://localhost:8000/tools/sum/call \
  -H "Content-Type: application/json" \
  -H "x-scopes: math:execute" \
  -d '{"arguments": {"a": 5, "b": 3}}'

# Should print: { "ok": true, "data": { "result": 8 } }

# Test 4: Test scope rejection
curl -X POST http://localhost:8000/tools/list-top-customers/call \
  -H "Content-Type: application/json" \
  -H "x-scopes: read:greetings" \
  -d '{"arguments": {"limit": 5}}'

# Should print: { "ok": false, "error": { "code": "SCOPE_MISSING" } }
```

## 5. Use Streamlit UI

Go to browser: **http://localhost:8501**

1. **Sidebar:** Confirm URL is `http://localhost:8000/mcp`
2. **Tab 1 - Discover Tools:**
   - Click "📋 Fetch Tools List"
   - Should show 4 tools as cards
3. **Tab 2 - Call Tool:**
   - Select "hello"
   - Edit name to "Streamlit"
   - Click "▶️ Call Tool"
   - See response: `{ message: "Hello, Streamlit!..." }`
4. **Tab 2 - Test Scope Rejection:**
   - Select "list-top-customers"
   - Remove `customers:read` from sidebar x-scopes
   - Click "▶️ Call Tool"
   - See error: `SCOPE_MISSING`

## 6. Production Deployment

### Deploy Domain A

```bash
cd apps/domain-a-tools-worker

# Set production secret
wrangler secret put DOMAIN_SHARED_SECRET --env production
# Paste: your-production-secret-123

# Deploy
wrangler deploy --env production

# Note the URL:
# Deployed to https://domain-a-<hash>.workers.dev
```

### Deploy Domain B

```bash
cd apps/domain-b-tools-worker

# Set production secret (same as Domain A)
wrangler secret put DOMAIN_SHARED_SECRET --env production
# Paste: your-production-secret-123

# Deploy
wrangler deploy --env production

# Note the URL:
# Deployed to https://domain-b-<hash>.workers.dev
```

### Deploy Gateway

```bash
cd apps/mcp-gateway-worker

# Edit wrangler.toml with production URLs
# Find [env.production] section and update:
# DOMAIN_A_URL = "https://domain-a-<your-hash>.workers.dev"
# DOMAIN_B_URL = "https://domain-b-<your-hash>.workers.dev"

# Set production secret
wrangler secret put DOMAIN_SHARED_SECRET --env production
# Paste: your-production-secret-123

# Deploy
wrangler deploy --env production

# Note the URL:
# Deployed to https://mcp-gateway-<hash>.workers.dev
```

### Test Production

```bash
GATEWAY_URL="https://mcp-gateway-<your-hash>.workers.dev"

# List tools
curl "$GATEWAY_URL/tools" \
  -H "x-scopes: read:greetings,customers:read,math:execute,text:transform" | jq '.'

# Call tool
curl -X POST "$GATEWAY_URL/tools/hello/call" \
  -H "Content-Type: application/json" \
  -H "x-scopes: read:greetings" \
  -d '{"arguments": {"name": "Production"}}'
```

## 7. Troubleshooting

### "Connection refused" on any worker

**Check:**
- Is the worker started? (should see "Ready on http://...")
- Is port in use? (8000, 8001, 8002, 8501 must be free)
- Are you in the right directory?

**Fix:**
```bash
# Kill process using port (macOS/Linux)
lsof -ti:8000 | xargs kill -9

# Or just restart the worker
pnpm dev
```

### "Module not found" or build errors

**Check:**
- Run `pnpm install:all` in repo root
- Verify Node version: `node -v` (should be 18+)

**Fix:**
```bash
cd mcp-server-rpc-tools
rm -rf node_modules
pnpm install:all
pnpm -r build
```

### "Invalid or missing gateway token" (403)

**Check:**
- Did you run `wrangler secret put DOMAIN_SHARED_SECRET`?
- Is the secret set to same value on all 3 workers?

**Fix:**
```bash
# Re-set secrets on all workers
cd apps/domain-a-tools-worker && wrangler secret put DOMAIN_SHARED_SECRET
cd apps/domain-b-tools-worker && wrangler secret put DOMAIN_SHARED_SECRET
cd apps/mcp-gateway-worker && wrangler secret put DOMAIN_SHARED_SECRET
```

### Streamlit can't connect to gateway

**Check:**
- Is gateway running? (Terminal 3 should show "Ready on http://localhost:8000")
- Is Streamlit using correct URL? (Sidebar should show `http://localhost:8000/mcp`)

**Fix:**
```bash
# Test gateway directly
curl http://localhost:8000/health | jq '.'

# If fails, restart gateway:
cd apps/mcp-gateway-worker
pnpm dev
```

### "Missing required scopes" error

This is expected! It means scope enforcement is working.

**Test it:**
```bash
# This should fail (missing customers:read)
curl -X POST http://localhost:8000/tools/list-top-customers/call \
  -H "x-scopes: read:greetings" \
  -H "Content-Type: application/json" \
  -d '{"arguments": {"limit": 5}}'

# Fix: Add the scope
curl -X POST http://localhost:8000/tools/list-top-customers/call \
  -H "x-scopes: read:greetings,customers:read" \
  -H "Content-Type: application/json" \
  -d '{"arguments": {"limit": 5}}'
# Now it works!
```

## 8. What Just Happened?

You now have:

```
┌─────────────────────────────────────────┐
│  Streamlit UI (localhost:8501)          │
│  [Discover tools, call interactively]   │
└────────────────┬────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────┐
│  MCP Gateway (localhost:8000)           │
│  [Routes calls, validates scopes]       │
└────────┬──────────────────┬─────────────┘
         │                  │
         ↓                  ↓
    ┌─────────┐        ┌─────────┐
    │ Domain A │        │ Domain B │
    │ Tools    │        │ Tools    │
    └──────────┘        └──────────┘
    hello                sum
    list-top-customers   normalize-text
```

**Each component:**
- ✅ Runs independently
- ✅ Can be deployed separately
- ✅ Communicates over secure RPC
- ✅ Validates access via scopes

## 9. Next Steps

**Use It:**
- Integrate MCP gateway into Claude or other AI assistant
- Add more tools (copy domain-a pattern)
- Customize scopes for your use case

**Learn More:**
- See [README.md](./README.md) for full documentation
- See [PROJECT_MANIFEST.md](./PROJECT_MANIFEST.md) for comprehensive details
- Check each app's README (e.g., [mcp-gateway-worker/README.md](./apps/mcp-gateway-worker/README.md))

**Deploy to Production:**
- Follow Section 6 above
- Use custom secrets
- Update ALLOWED_ORIGINS in gateway

---

**You're done! 🎉** The MCP system is running.

For questions, refer to the READMEs in each app folder or PROJECT_MANIFEST.md for comprehensive details.
