# MCP Client - CopilotKit (Next.js)

CopilotKit-based frontend app wired to the live MCP gateway:

- Gateway endpoint: `https://mcp-gateway-worker.to-jamz.workers.dev/mcp`
- Runtime endpoint: `/api/copilotkit`

## What this app does

- Renders a CopilotKit chat UI in Next.js
- Exposes server-side CopilotKit actions:
	- `list_mcp_tools`
	- `call_mcp_tool`
- Both actions call the live gateway using MCP JSON-RPC

## Setup

From repo root:

```bash
pnpm install
```

Create env file:

```bash
cp apps/mcp-client-copilotkit/.env.example apps/mcp-client-copilotkit/.env.local
```

Add your model key in `.env.local`:

```bash
OPENAI_API_KEY=sk_your_key_here
OPENAI_MODEL=gpt-4o-mini
OPENAI_BASE_URL=
```

Or enter `OPENAI_API_KEY` directly in the UI field. The key is saved in browser local storage and sent to `/api/copilotkit` as `x-openai-api-key`.

## Run

```bash
pnpm --filter mcp-client-copilotkit dev
```

Then open `http://localhost:3000`.

## Build check

```bash
pnpm --filter mcp-client-copilotkit build
```

## Key files

- `app/page.tsx` – CopilotKit chat screen
- `components/copilot-gateway-chat.tsx` – Copilot provider + chat component
- `app/api/copilotkit/route.ts` – runtime + MCP gateway actions
- `.env.example` – environment settings
