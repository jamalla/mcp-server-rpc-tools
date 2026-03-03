"use client";

import { CopilotKit } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import { ProxiedCopilotRuntimeAgent } from "@copilotkitnext/core";
import { useEffect, useMemo, useState } from "react";

const OPENAI_STORAGE_KEY = "mcp_client_copilotkit_openai_api_key";

export function CopilotGatewayChat() {
  const [openAIApiKey, setOpenAIApiKey] = useState("");
  const [isHydrated, setIsHydrated] = useState(false);

  const localDefaultAgent = useMemo(
    () =>
      openAIApiKey
        ? new ProxiedCopilotRuntimeAgent({
            agentId: "default",
            description: "Local default Copilot runtime proxy",
            runtimeUrl: "/api/copilotkit",
            transport: "single",
            headers: {
              "x-openai-api-key": openAIApiKey,
            },
          })
        : undefined,
    [openAIApiKey],
  );

  useEffect(() => {
    const savedKey = window.localStorage.getItem(OPENAI_STORAGE_KEY) || "";
    setOpenAIApiKey(savedKey);
    setIsHydrated(true);
  }, []);

  const handleOpenAIApiKeyChange = (value: string) => {
    setOpenAIApiKey(value);
    window.localStorage.setItem(OPENAI_STORAGE_KEY, value);
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-3 space-y-2">
        <label htmlFor="openai-api-key" className="block text-sm font-medium">
          OpenAI API Key
        </label>
        <input
          id="openai-api-key"
          type="password"
          value={openAIApiKey}
          onChange={(e) => handleOpenAIApiKeyChange(e.target.value)}
          placeholder="sk-..."
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      {!isHydrated ? (
        <div className="rounded-md bg-zinc-100 p-3 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          Initializing chat...
        </div>
      ) : !openAIApiKey ? (
        <div className="rounded-md bg-zinc-100 p-3 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          Enter your OpenAI API key above to start the Copilot chat.
        </div>
      ) : (
        <CopilotKit
          runtimeUrl="/api/copilotkit"
          useSingleEndpoint
          headers={{ "x-openai-api-key": openAIApiKey }}
          agents__unsafe_dev_only={
            localDefaultAgent ? { default: localDefaultAgent } : {}
          }
        >
          <CopilotChat
            instructions={
              "You are an assistant for MCP tools. Use list_mcp_tools to inspect available tools, then call_mcp_tool to execute tools."
            }
          />
        </CopilotKit>
      )}
    </div>
  );
}
