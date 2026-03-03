# MCP Client - Streamlit

A **Python Streamlit web UI** for testing the MCP Gateway. No fragile MCP Python client libraries—just clean HTTP requests.

## Overview

Simple Streamlit app that provides:
- Interactive tool discovery (`tools/list`)
- Tool selection & parameter editing
- JSON-RPC request execution
- Pretty-printed responses
- Debug panel for raw requests

## File Structure

```
mcp-client-streamlit/
├── app.py                 # Main Streamlit app
├── requirements.txt       # Python dependencies
└── README.md             # This file
```

## Setup

### 1. Install Dependencies

```bash
cd apps/mcp-client-streamlit
pip install -r requirements.txt
```

Optional (enable AI Agent tab):

```bash
pip install langchain==1.2.9 langchain-core==1.2.9 langchain-groq==1.1.2
```

Or with a virtual environment:

```bash
# Create venv
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install
pip install -r requirements.txt

# Optional AI Agent support
pip install langchain==1.2.9 langchain-core==1.2.9 langchain-groq==1.1.2
```

### 2. Run the App

```bash
streamlit run app.py
```

Opens automatically in browser at `http://localhost:8501`.

## Configuration

### MCP Gateway URL

Set in sidebar:
```
MCP Gateway URL: http://localhost:8000/mcp
```

Or set environment variable:
```bash
export MCP_GATEWAY_URL=http://localhost:8000/mcp
streamlit run app.py
```

### Request Headers

**x-tenant-id** (optional)
- Used for multi-tenant scenarios
- Propagated to all tool calls

**x-actor-id** (optional)
- User/actor identifier
- Propagated to all tool calls

**x-scopes** (required)
- Comma-separated list of scopes
- Pre-populated with all demo scopes:
  ```
  read:greetings,customers:read,math:execute,text:transform
  ```
- Remove scopes to test rejection
- Editor supports both comma-separated and newline-separated formats

## Usage

### Tab 1: Discover Tools

1. Click **📋 Fetch Tools List**
2. Gateway returns all available tools

```
✓ Found 4 tools

┌─ hello ─────────────────────┐
│ Description: ...            │
│ Domain: A                   │
│ Required Scopes: ...        │
└─────────────────────────────┘

┌─ list-top-customers ────────┐
│ Description: ...            │
│ Domain: A                   │
│ Required Scopes: ...        │
└─────────────────────────────┘
... and more
```

### Tab 2: Call Tool

1. Select a tool from dropdown
2. View description and required scopes
3. Edit JSON arguments (editor auto-fills defaults)
4. Click **▶️ Call Tool**
5. See response

**Example:**

```
Tool: hello
Arguments:
{
  "name": "Alice"
}

[▶️ Call Tool]

✅ Tool executed successfully
{
  "message": "Hello, Alice! Welcome to Domain A."
}
```

### Tab 3: Raw Requests

Debug mode for manual JSON-RPC requests.

**Mode 1: tools/list**
- Fetches tool list
- Shows HTTP response

**Mode 2: tools/call**
- Send custom tool call
- Specify tool name & JSON arguments
- Shows HTTP response

```
Tool name: sum
Tool arguments:
{
  "a": 10,
  "b": 5
}

[Send Request]

Status: 200
{
  "ok": true,
  "data": {
    "result": 15,
    "a": 10,
    "b": 5
  }
}
```

## Testing Scenarios

### Scenario 1: Happy Path (All Scopes)

**Setup:**
- Keep all scopes in sidebar
- Discover tools
- Call each tool

**Expected:**
- All 4 tools execute successfully

### Scenario 2: Scope Rejection

**Setup:**
- Remove `customers:read` from scopes
- Discover tools
- Try to call `list-top-customers`

**Expected:**
- 403 response with SCOPE_MISSING error
- Message: "Missing required scopes: customers:read"

### Scenario 3: Invalid Tool

**Setup:**
- Tab: Raw Requests
- Tool name: `invalid-tool`
- Arguments: `{}`

**Expected:**
- 404 response with TOOL_NOT_FOUND error

### Scenario 4: Gateway Offline

**Setup:**
- Stop gateway worker
- Try to fetch tools list

**Expected:**
- Connection error message
- "Make sure the gateway is running and the URL is correct."

## Architecture

```
┌─────────────────────────────────┐
│  Streamlit Web UI (Port 8501)   │
│                                 │
│  - Tool discovery panel         │
│  - Parameter editor             │
│  - Response viewer              │
│  - Debug panel                  │
└────────────┬────────────────────┘
             │
             │ HTTP
             ↓
┌─────────────────────────────────┐
│  MCP Gateway (Port 8000)        │
│                                 │
│  - Scope validation             │
│  - Tool routing                 │
│  - Error handling               │
└─────────────────────────────────┘
```

## API Calls from Client

All calls are via REST endpoints (not JSON-RPC for simplicity):

### List Tools

```
GET /tools

Response:
{
  "ok": true,
  "data": {
    "tools": [...],
    "count": 4
  }
}
```

### Call Tool

```
POST /tools/:name/call

Body:
{
  "arguments": { ... tool input ... }
}

Response:
{
  "ok": true,
  "data": { ... tool output ... }
}
```

## Troubleshooting

### "Make sure the gateway is running"
- Check gateway is running: `pnpm dev:gateway`
- Verify URL in sidebar matches actual gateway URL
- Test with curl first:
  ```bash
  curl http://localhost:8000/health
  ```

### "Missing required scopes"
- Check tool definition for required scope
- Add scope to sidebar `x-scopes` field
- Scopes are comma-separated or newline-separated

### "Tool execution failed"
- Check gateway logs for errors
- Verify domain workers are running
- Test domain directly with curl

### "Connection refused"
- Ensure all workers are running (terminals 1-3)
- Check port 8000 is not in use
- Try different URL if behind proxy

## Requirements

- Python 3.9+
- Streamlit 1.28+
- requests 2.31+
- No MCP SDK required (direct HTTP calls)

## Environment Variables

```bash
# Override gateway URL (optional)
export MCP_GATEWAY_URL=https://my-gateway.workers.dev/mcp
streamlit run app.py
```

## Deployment

This is a local dev app. For production, use a proper MCP client library or integrate with Claude/other AI assistants.

### Local Sharing

Share with teammates on LAN:
```bash
streamlit run app.py --server.address 0.0.0.0
# Access at http://<your-ip>:8501
```

### Docker

```dockerfile
FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY app.py .
EXPOSE 8501
CMD ["streamlit", "run", "app.py"]
```

## License

MIT
