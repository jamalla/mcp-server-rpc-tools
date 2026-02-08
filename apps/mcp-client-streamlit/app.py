import os
import json
import streamlit as st
import requests
from typing import Optional, Dict, Any

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

# Default to localhost if not in production
default_url = os.getenv("MCP_GATEWAY_URL", "http://localhost:8000/mcp")

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

tab1, tab2, tab3 = st.tabs(["Discover Tools", "Call Tool", "Raw Requests"])

with tab1:
    st.subheader("Available Tools")

    if st.button("📋 Fetch Tools List", key="fetch_tools"):
        with st.spinner("Fetching tools..."):
            try:
                # Use /tools REST endpoint for discovery (or MCP if you prefer)
                rest_url = mcp_url.replace("/mcp", "/tools")
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
                                with st.container(border=True):
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
                    st.json(response.text)
            except requests.exceptions.RequestException as e:
                st.error(f"Error connecting to MCP Gateway: {e}")
                st.info("Make sure the gateway is running and the URL is correct.")

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
                                response = requests.post(
                                    f"{mcp_url.replace('/mcp', '')}/tools/{selected_tool_name}/call",
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
                    rest_url = mcp_url.replace("/mcp", "/tools")
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
                    response = requests.post(
                        f"{mcp_url.replace('/mcp', '')}/tools/{tool_name}/call",
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
