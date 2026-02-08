# Streamlit Community Cloud Deployment Guide

Deploy the MCP Client Streamlit app to Streamlit Community Cloud.

## Prerequisites

- ✅ GitHub account with repository pushed
- ✅ Streamlit Community Cloud account (free at https://share.streamlit.io)
- ✅ GROQ API key for the app to function

## Deployment Steps

### Step 1: Sign Up / Log In to Streamlit Community Cloud

1. Go to https://share.streamlit.io
2. Click **"Sign in with GitHub"**
3. Authorize Streamlit to access your GitHub account
4. Click **"New app"**

### Step 2: Select Repository

1. Click **"New app"** button
2. Select your repository: `jamalla/mcp-server-rpc-tools`
3. Branch: `main`
4. File path: `apps/mcp-client-streamlit/app.py`
5. Click **"Deploy"**

Streamlit will start building and deploying your app. This takes ~2-3 minutes.

### Step 3: App URL

Once deployed, your app will be available at:
```
https://<random-string>.streamlit.app
```

Streamlit will show this URL in the interface. Share it with others!

### Step 4: Configure Secrets (Optional but Recommended)

If you want to set environment variables securely:

1. Go to your app on https://share.streamlit.io
2. Click the **⋮** (menu) → **Settings**
3. Click **"Secrets"** tab
4. Add your GROQ API key:
```
GROQ_API_KEY=gsk_your_key_here
```

Save and the app will restart with the secret available.

### Step 5: Test the App

1. Open your app URL
2. In the sidebar, verify **MCP Gateway URL** shows: `https://mcp-gateway-worker.to-jamz.workers.dev/`
3. Try the different tabs:
   - **Discover Tools**: List all available tools
   - **Call Tool**: Manually invoke a tool
   - **Raw Requests**: Test with JSON-RPC directly
   - **AI Agent**: Chat with the AI agent (requires GROQ API key)

## Environment Variables in Production

The app reads from environment variables (or uses defaults):

| Variable | Default | Purpose |
|----------|---------|---------|
| `MCP_GATEWAY_URL` | `https://mcp-gateway-worker.to-jamz.workers.dev/` | Gateway endpoint |
| `GROQ_API_KEY` | `""` | Optional: For AI Agent tab |

In Streamlit Cloud, set these in **Settings → Secrets** or they'll use defaults.

## Troubleshooting

### App shows "Gateway connection failed"

- Verify the gateway URL is reachable: `https://mcp-gateway-worker.to-jamz.workers.dev/`
- Check if your network/firewall allows outbound HTTPS to workers.dev
- Try using a browser with developer console open (F12) to see network errors

### "CORS error" or "Request blocked"

- The gateway needs to have your Streamlit app URL in `ALLOWED_ORIGINS`
- Contact gateway admin to add the Streamlit app URL
- Or temporarily update gateway wrangler.toml:
  ```toml
  [vars]
  ALLOWED_ORIGINS = "localhost:3000,localhost:8501,<your-streamlit-url>"
  ```

### AI Agent tab shows "cannot import"

- Ensure `requirements.txt` has been updated with all packages
- Streamlit Cloud will auto-install from `requirements.txt`

### App is slow or times out

- Streamlit Community Cloud has resource limits
- Consider scaling to Streamlit Teams or deploying elsewhere

## Monitoring

View app logs on Streamlit Community Cloud:

1. Go to your app dashboard
2. Click the **⋮** (menu) → **Manage app**
3. View **Logs** tab for real-time output

## Redeployment

Any push to `main` branch will trigger automatic redeploy. To manually redeploy:

1. Go to your app on https://share.streamlit.io
2. Click the **⋮** (menu) → **Rerun app** (if you just pushed changes)

## Advanced: Custom Domain

Upgrade to Streamlit Teams to use a custom domain:
- https://streamlit.io/cloud

## Success!

Your Streamlit app is now live and accessible globally! 

**Share the URL:**
```
https://<your-streamlit-app>.streamlit.app
```

Users can now:
- Discover MCP tools
- Test tool execution
- Chat with AI agent powered by GROQ
- Debug with raw JSON-RPC requests

---

**Need help?** Check:
- Streamlit docs: https://docs.streamlit.io/deploy
- MCP Gateway logs: Use `wrangler tail` on gateway worker
- This project's README.md

