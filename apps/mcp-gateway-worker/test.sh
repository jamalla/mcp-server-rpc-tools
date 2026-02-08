#!/bin/bash
# Test script for MCP Gateway Worker

set -e

BASE_URL="http://localhost:8000"

echo "=========================================="
echo "MCP Gateway Worker - Test Suite"
echo "=========================================="
echo ""

# Test 1: Health check
echo "[1] Health Check"
curl -s "$BASE_URL/health" | jq '.'
echo ""

# Test 2: Gateway info
echo "[2] Gateway Info"
curl -s "$BASE_URL/" | jq '.'
echo ""

# Test 3: List tools (REST)
echo "[3] List Tools (REST) - With all scopes"
curl -s "$BASE_URL/tools" \
  -H "x-scopes: read:greetings,customers:read,math:execute,text:transform" | jq '.'
echo ""

# Test 4: Call hello tool
echo "[4] Call Hello Tool"
curl -s -X POST "$BASE_URL/tools/hello/call" \
  -H "Content-Type: application/json" \
  -H "x-scopes: read:greetings" \
  -d '{"arguments": {"name": "Gateway Test"}}' | jq '.'
echo ""

# Test 5: Call list-top-customers
echo "[5] Call List Top Customers"
curl -s -X POST "$BASE_URL/tools/list-top-customers/call" \
  -H "Content-Type: application/json" \
  -H "x-scopes: customers:read" \
  -d '{"arguments": {"limit": 2}}' | jq '.'
echo ""

# Test 6: Call sum tool
echo "[6] Call Sum Tool"
curl -s -X POST "$BASE_URL/tools/sum/call" \
  -H "Content-Type: application/json" \
  -H "x-scopes: math:execute" \
  -d '{"arguments": {"a": 10, "b": 5}}' | jq '.'
echo ""

# Test 7: Call normalize-text
echo "[7] Call Normalize Text"
curl -s -X POST "$BASE_URL/tools/normalize-text/call" \
  -H "Content-Type: application/json" \
  -H "x-scopes: text:transform" \
  -d '{"arguments": {"text": "Hello Worlde", "mode": "upper"}}' | jq '.'
echo ""

# Test 8: Scope rejection
echo "[8] Scope Rejection - Missing customers:read (403)"
curl -s -X POST "$BASE_URL/tools/list-top-customers/call" \
  -H "Content-Type: application/json" \
  -H "x-scopes: read:greetings" \
  -d '{"arguments": {"limit": 5}}' | jq '.'
echo ""

# Test 9: Tool not found
echo "[9] Tool Not Found (404)"
curl -s -X POST "$BASE_URL/tools/nonexistent/call" \
  -H "Content-Type: application/json" \
  -H "x-scopes: read:greetings" \
  -d '{"arguments": {}}' | jq '.'
echo ""

# Test 10: MCP JSON-RPC tools/list
echo "[10] MCP JSON-RPC: tools/list"
curl -s -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "x-scopes: read:greetings,customers:read,math:execute,text:transform" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }' | jq '.result.tools | length'
echo ""

# Test 11: MCP JSON-RPC tools/call
echo "[11] MCP JSON-RPC: tools/call (hello)"
curl -s -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "x-scopes: read:greetings" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "hello",
      "arguments": {"name": "MCP Test"}
    }
  }' | jq '.'
echo ""

# Test 12: MCP scope rejection
echo "[12] MCP JSON-RPC: Scope Rejection"
curl -s -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "x-scopes: read:greetings" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "list-top-customers",
      "arguments": {"limit": 5}
    }
  }' | jq '.'
echo ""

echo "=========================================="
echo "All tests complete!"
echo "=========================================="
