import os
import json
import streamlit as st
import requests
from typing import Optional, Dict, Any

# Try to import LangChain packages
LANGCHAIN_AVAILABLE = False
LANGCHAIN_ERROR = None
# Try to import LangChain packages
LANGCHAIN_AVAILABLE = False
LANGCHAIN_ERROR = None
try:
    from langchain_groq import ChatGroq
    from langchain_core.messages import HumanMessage
    LANGCHAIN_AVAILABLE = True
except ImportError as e:
    LANGCHAIN_ERROR = str(e)

# ============================================================================
# Helper Functions
# ============================================================================


def get_default_args(tool_name: str) -> Dict[str, Any]:
    """Return default arguments for each tool"""
    defaults = {
        "hello": {"name": ""},
        "list-top-customers": {"limit": 5},
        "sum": {"a": 0, "b": 0},
        "normalize-text": {"text": "", "mode": "lower"},
    }
    return defaults.get(tool_name, {})


def get_gateway_base_url(mcp_url: str) -> str:
    """Extract base URL from MCP URL, removing /mcp endpoint"""
    url = mcp_url.rstrip("/")
    if url.endswith("/mcp"):
        return url[:-4]  # Remove /mcp suffix
    return url


# ============================================================================
# Page configuration
st.set_page_config(
    page_title="MCP Gateway Client",
    page_icon="🔧",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.title("🔧 MCP Gateway Client")
st.markdown(
    """
Test the MCP Gateway and domain tools. Set your headers, discover tools, and call them interactively.
"""
)

# ============================================================================
# Sidebar: Configuration
# ============================================================================

st.sidebar.header("Configuration")

# Default to production gateway
default_url = os.getenv("MCP_GATEWAY_URL", "https://mcp-gateway-worker.to-jamz.workers.dev/")

mcp_url = st.sidebar.text_input(
    "MCP Gateway URL",
    value=default_url,
    help="Full URL to MCP endpoint (usually ends with /mcp)",
)

st.sidebar.divider()
st.sidebar.subheader("Request Headers")

tenant_id = st.sidebar.text_input(
    "x-tenant-id",
    value="",
    placeholder="Optional tenant ID",
)

actor_id = st.sidebar.text_input(
    "x-actor-id",
    value="",
    placeholder="Optional actor ID",
)

scopes_input = st.sidebar.text_area(
    "x-scopes",
    value="read:greetings,customers:read,math:execute,text:transform",
    height=100,
    help="Comma-separated list of scopes. One per line is also supported.",
)

# Parse scopes (handle both formats)
scopes_list = []
for line in scopes_input.split("\n"):
    line = line.strip()
    if line:
        # Handle both comma-separated and line-separated
        scopes_list.extend([s.strip() for s in line.split(",")])

scopes_header = ",".join(scopes_list)

# Build headers
headers = {
    "Content-Type": "application/json",
}
if tenant_id:
    headers["x-tenant-id"] = tenant_id
if actor_id:
    headers["x-actor-id"] = actor_id
if scopes_list:
    headers["x-scopes"] = scopes_header

st.sidebar.divider()
if st.sidebar.checkbox("Show headers", value=False):
    st.sidebar.json(headers)

# ============================================================================
# Main: Tools Discovery & Calling
# ============================================================================

tab1, tab2, tab3, tab4 = st.tabs(["Discover Tools", "Call Tool", "Raw Requests", "AI Agent"])

with tab1:
    st.subheader("Available Tools")

    if st.button("📋 Fetch Tools List", key="fetch_tools"):
        with st.spinner("Fetching tools..."):
            try:
                # Use /tools REST endpoint for discovery
                base_url = get_gateway_base_url(mcp_url)
                rest_url = f"{base_url}/tools"
                
                # Show URL for debugging
                st.info(f"📡 Calling: `{rest_url}`")
                
                response = requests.get(rest_url, headers=headers, timeout=10)

                if response.status_code == 200:
                    data = response.json()
                    tools = data.get("data", {}).get("tools", [])

                    st.success(f"Found {len(tools)} tools")

                    if tools:
                        # Display tools as cards
                        cols = st.columns(2)
                        for idx, tool in enumerate(tools):
                            with cols[idx % 2]:
                                # `border` argument removed for compatibility across Streamlit versions
                                with st.container():
                                    st.markdown(f"### {tool['name']}")
                                    st.markdown(tool["description"])
                                    st.markdown(
                                        f"**Domain:** `{tool['domain']}`"
                                    )
                                    st.markdown(
                                        f"**Required Scopes:** {', '.join([f'`{s}`' for s in tool['requiredScopes']])}"
                                    )
                    st.session_state.tools = tools
                else:
                    st.error(f"Failed to fetch tools: {response.status_code}")
                    st.code(response.text[:500], language="text")  # Show first 500 chars of response
            except requests.exceptions.RequestException as e:
                st.error(f"Error connecting to MCP Gateway: {e}")
                st.info("Make sure the gateway is running and the URL is correct.")
            except json.JSONDecodeError as e:
                st.error(f"Invalid JSON response: {e}")
                st.code(response.text[:500], language="text")

with tab2:
    st.subheader("Call a Tool")

    # Get available tools from session
    tools = st.session_state.get("tools", [])

    if not tools:
        st.info(
            "📋 First, fetch the tools list using the 'Discover Tools' tab."
        )
    else:
        tool_names = [t["name"] for t in tools]
        selected_tool_name = st.selectbox("Select Tool", tool_names)

        if selected_tool_name:
            # Find tool definition
            selected_tool = next(
                (t for t in tools if t["name"] == selected_tool_name), None
            )

            if selected_tool:
                st.markdown(f"**Description:** {selected_tool['description']}")
                st.markdown(
                    f"**Required Scopes:** {', '.join([f'`{s}`' for s in selected_tool.get('requiredScopes', [])])}"
                )

                # Input schema editor
                st.markdown("### Tool Arguments")

                # Simple JSON editor for arguments
                args_json = st.text_area(
                    "Tool Arguments (JSON)",
                    value=json.dumps(
                        get_default_args(selected_tool_name), indent=2
                    ),
                    height=200,
                    key=f"args_{selected_tool_name}",
                )

                try:
                    arguments = json.loads(args_json)
                except json.JSONDecodeError:
                    st.error("Invalid JSON in arguments")
                    arguments = None

                if st.button("▶️ Call Tool", key="call_tool"):
                    if arguments is None:
                        st.error("Please fix JSON errors first")
                    else:
                        with st.spinner(f"Calling {selected_tool_name}..."):
                            try:
                                # Call via REST endpoint
                                base_url = get_gateway_base_url(mcp_url)
                                response = requests.post(
                                    f"{base_url}/tools/{selected_tool_name}/call",
                                    json={"arguments": arguments},
                                    headers=headers,
                                    timeout=10,
                                )

                                st.divider()

                                if response.status_code == 200:
                                    result = response.json()
                                    if result.get("ok"):
                                        st.success("✅ Tool executed successfully")
                                        st.json(result.get("data", {}))
                                    else:
                                        error = result.get("error", {})
                                        st.error(
                                            f"❌ Tool error: {error.get('message', 'Unknown error')}"
                                        )
                                        st.json(result)
                                else:
                                    st.error(
                                        f"❌ Request failed: {response.status_code}"
                                    )
                                    try:
                                        st.json(response.json())
                                    except:
                                        st.text(response.text)

                            except requests.exceptions.RequestException as e:
                                st.error(f"Error calling tool: {e}")

with tab3:
    st.subheader("Raw MCP Requests")

    request_type = st.radio(
        "Request Type",
        ["tools/list", "tools/call"],
    )

    if request_type == "tools/list":
        st.info("This will use the /tools endpoint (REST)")
        if st.button("Send Request"):
            with st.spinner("Sending request..."):
                try:
                    base_url = get_gateway_base_url(mcp_url)
                    rest_url = f"{base_url}/tools"
                    response = requests.get(
                        rest_url, headers=headers, timeout=10
                    )
                    st.json(
                        {
                            "status_code": response.status_code,
                            "response": response.json(),
                        }
                    )
                except Exception as e:
                    st.error(f"Error: {e}")

    else:  # tools/call
        st.markdown("Sending raw MCP tools/call request...")

        tool_name = st.text_input("Tool name")
        raw_args = st.text_area(
            "Tool arguments (JSON)",
            value="{}",
            height=150,
        )

        if st.button("Send Request"):
            with st.spinner("Sending request..."):
                try:
                    arguments = json.loads(raw_args)

                    # Send via REST endpoint instead of MCP JSON-RPC
                    base_url = get_gateway_base_url(mcp_url)
                    response = requests.post(
                        f"{base_url}/tools/{tool_name}/call",
                        json={"arguments": arguments},
                        headers=headers,
                        timeout=10,
                    )

                    st.json(
                        {
                            "status_code": response.status_code,
                            "response": response.json(),
                        }
                    )
                except json.JSONDecodeError:
                    st.error("Invalid JSON in arguments")
                except Exception as e:
                    st.error(f"Error: {e}")

with tab4:
    st.subheader("🤖 AI Agent with MCP Tools")
    st.markdown(
        """
This AI agent uses LangChain + GROQ to intelligently call MCP tools based on user requests.
The agent can access all available tools and decide which ones to use.
"""
    )

    # Initialize session state for chat history
    if "agent_messages" not in st.session_state:
        st.session_state.agent_messages = []

    # API Key input
    groq_api_key = st.sidebar.text_input(
        "GROQ API Key",
        value=os.getenv("GROQ_API_KEY", ""),
        type="password",
        help="Get your API key from https://console.groq.com/",
        key="groq_key_input",
    )

    if not groq_api_key:
        st.warning("⚠️ Please enter your GROQ API Key in the sidebar to use the AI Agent")
    else:
        # Load tools from cache or fetch fresh
        if st.button("🔄 Refresh Tools for Agent", key="refresh_tools_agent"):
            try:
                base_url = get_gateway_base_url(mcp_url)
                resp = requests.get(f"{base_url}/tools", headers=headers, timeout=10)
                if resp.status_code == 200:
                    st.session_state.agent_tools = resp.json().get("data", {}).get("tools", [])
                    st.success(f"Loaded {len(st.session_state.agent_tools)} tools")
            except Exception as e:
                st.error(f"Failed to load tools: {e}")

        # Initialize tools if not in session
        if "agent_tools" not in st.session_state:
            try:
                base_url = get_gateway_base_url(mcp_url)
                resp = requests.get(f"{base_url}/tools", headers=headers, timeout=10)
                if resp.status_code == 200:
                    st.session_state.agent_tools = resp.json().get("data", {}).get("tools", [])
            except Exception as e:
                st.error(f"Failed to load tools: {e}")
                st.session_state.agent_tools = []

        # Display chat history
        st.markdown("### Conversation")
        for message in st.session_state.agent_messages:
            with st.chat_message(message["role"]):
                st.markdown(message["content"])

        # User input
        user_input = st.chat_input("Ask the AI agent to do something with the tools...")

        if user_input:
            # Add user message to history
            st.session_state.agent_messages.append({"role": "user", "content": user_input})

            with st.chat_message("user"):
                st.markdown(user_input)

            # Call AI Agent
            with st.spinner("🤔 Agent is thinking..."):
                if not LANGCHAIN_AVAILABLE:
                    st.error(
                        "⚠️ LangChain packages not installed.\n\n"
                        "Please run in your terminal:\n"
                        "```\n"
                        "cd apps/mcp-client-streamlit\n"
                        "py -m pip install langchain langchain-groq langchain-core\n"
                        "```\n\n"
                        f"Error details: {LANGCHAIN_ERROR}"
                    )
                else:
                    try:
                        # Initialize GROQ LLM
                        llm = ChatGroq(
                            groq_api_key=groq_api_key,
                            model_name="qwen/qwen3-32b",
                            temperature=0,
                        )

                        # Build tool descriptions
                        tools_info = ""
                        if "agent_tools" in st.session_state:
                            for tool in st.session_state.agent_tools:
                                tools_info += f"\n- **{tool['name']}**: {tool['description']}\n"
                                if "parameters" in tool:
                                    params = tool["parameters"]
                                    if isinstance(params, dict):
                                        tools_info += f"  Parameters: {json.dumps(params)}\n"

                        # Create initial system prompt
                        system_msg = f"""You are a helpful AI assistant with access to tools. 
You can use the following tools to help answer user questions:
{tools_info}

When you need to use a tool, respond with:
TOOL_CALL: {{tool_name}} {{json_params}}

For example:
TOOL_CALL: sum {{"a": 5, "b": 3}}
TOOL_CALL: hello {{"name": "World"}}

After receiving tool results, provide a natural language answer to the user."""

                        messages = [HumanMessage(content=system_msg)]
                        messages.append(HumanMessage(content=user_input))

                        # Simple agentic loop
                        max_iterations = 5
                        for iteration in range(max_iterations):
                            # Call LLM
                            response = llm.invoke(messages)
                            response_text = response.content

                            # Check if tool was called
                            if "TOOL_CALL:" in response_text:
                                # Parse tool call
                                lines = response_text.split("\n")
                                tool_calls_made = False
                                for line in lines:
                                    if line.strip().startswith("TOOL_CALL:"):
                                        tool_calls_made = True
                                        # Extract tool name and params
                                        parts = line.replace("TOOL_CALL:", "").strip().split(" ", 1)
                                        if len(parts) >= 1:
                                            tool_name = parts[0]
                                            try:
                                                params = json.loads(parts[1]) if len(parts) > 1 else {}
                                            except:
                                                params = {}

                                            # Call the tool
                                            try:
                                                base_url = get_gateway_base_url(mcp_url)
                                                resp = requests.post(
                                                    f"{base_url}/tools/{tool_name}/call",
                                                    json={"input": params},
                                                    headers=headers,
                                                    timeout=10,
                                                )
                                                if resp.status_code == 200:
                                                    data = resp.json()
                                                    if data.get("ok"):
                                                        tool_result = json.dumps(data.get("data", {}))
                                                    else:
                                                        tool_result = f"Error: {data.get('error', {}).get('message', 'Unknown error')}"
                                                else:
                                                    tool_result = f"HTTP {resp.status_code}: {resp.text[:200]}"
                                            except Exception as e:
                                                tool_result = f"Exception: {str(e)}"

                                            # Add to conversation
                                            messages.append(HumanMessage(content=response_text))
                                            messages.append(HumanMessage(content=f"Tool result: {tool_result}"))

                                if not tool_calls_made:
                                    # No valid tool calls found, use response as is
                                    break
                            else:
                                # No tool call, this is the final response
                                break

                        # Extract final response (skip TOOL_CALL lines)
                        final_response = "\n".join(
                            [line for line in response_text.split("\n") if not line.strip().startswith("TOOL_CALL:")]
                        ).strip()

                        if not final_response:
                            final_response = response_text

                        # Add assistant message to history
                        st.session_state.agent_messages.append(
                            {"role": "assistant", "content": final_response}
                        )

                        with st.chat_message("assistant"):
                            st.markdown(final_response)

                    except Exception as e:
                        error_msg = f"Agent Error: {str(e)}"
                        st.error(error_msg)
                        st.session_state.agent_messages.append(
                            {"role": "assistant", "content": error_msg}
                        )

# ============================================================================
# Footer
# ============================================================================

st.divider()
st.markdown(
    """
---
**MCP Gateway Client** — Test your tools easily.

📚 [MCP Specification](https://spec.modelcontextprotocol.io/)
"""
)
