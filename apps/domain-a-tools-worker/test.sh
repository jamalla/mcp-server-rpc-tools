#!/bin/bash
# Test script for Domain A Tools Worker

set -e

GATEWAY_TOKEN="dev-secret-123"
BASE_URL="http://localhost:8001"

echo "=========================================="
echo "Domain A Tools Worker - Test Suite"
echo "=========================================="
echo ""

# Test 1: Health check
echo "[1] Health Check"
curl -s "$BASE_URL/health" | jq '.'
echo ""

# Test 2: hello tool (success)
echo "[2] Hello Tool (Success)"
curl -s -X POST "$BASE_URL/tools/hello/invoke" \
  -H "x-gateway-token: $GATEWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "input": { "name": "Alice" },
    "context": { "scopes": ["read:greetings"] }
  }' | jq '.'
echo ""

# Test 3: list-top-customers tool
echo "[3] List Top Customers Tool"
curl -s -X POST "$BASE_URL/tools/list-top-customers/invoke" \
  -H "x-gateway-token: $GATEWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "input": { "limit": 3 },
    "context": { "scopes": ["customers:read"] }
  }' | jq '.'
echo ""

# Test 4: Tool not found
echo "[4] Tool Not Found (404)"
curl -s -X POST "$BASE_URL/tools/invalid-tool/invoke" \
  -H "x-gateway-token: $GATEWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"input": {}}' | jq '.'
echo ""

# Test 5: Invalid token
echo "[5] Invalid Token (403)"
curl -s -X POST "$BASE_URL/tools/hello/invoke" \
  -H "x-gateway-token: wrong-secret" \
  -H "Content-Type: application/json" \
  -d '{"input": { "name": "Bob" }}' | jq '.'
echo ""

# Test 6: Missing token
echo "[6] Missing Token (403)"
curl -s -X POST "$BASE_URL/tools/hello/invoke" \
  -H "Content-Type: application/json" \
  -d '{"input": { "name": "Charlie" }}' | jq '.'
echo ""

# Test 7: Invalid input (validation)
echo "[7] Validation Error (400)"
curl -s -X POST "$BASE_URL/tools/list-top-customers/invoke" \
  -H "x-gateway-token: $GATEWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "input": { "limit": 999 },
    "context": {}
  }' | jq '.'
echo ""

echo "=========================================="
echo "All tests complete!"
echo "=========================================="
