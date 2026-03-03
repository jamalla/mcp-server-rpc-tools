import { CopilotGatewayChat } from "@/components/copilot-gateway-chat";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-4 p-6">
      <header>
        <h1 className="text-2xl font-semibold">MCP CopilotKit Client</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Connected to live gateway: https://mcp-gateway-worker.to-jamz.workers.dev/mcp
        </p>
      </header>
      <CopilotGatewayChat />
    </main>
  );
}
