#!/bin/bash
# Test script for Domain B Tools Worker

set -e

GATEWAY_TOKEN="dev-secret-123"
BASE_URL="http://localhost:8002"

echo "=========================================="
echo "Domain B Tools Worker - Test Suite"
echo "=========================================="
echo ""

# Test 1: Health check
echo "[1] Health Check"
curl -s "$BASE_URL/health" | jq '.'
echo ""

# Test 2: sum tool
echo "[2] Sum Tool (Success)"
curl -s -X POST "$BASE_URL/tools/sum/invoke" \
  -H "x-gateway-token: $GATEWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "input": { "a": 5, "b": 3 },
    "context": { "scopes": ["math:execute"] }
  }' | jq '.'
echo ""

# Test 3: normalize-text tool (lower)
echo "[3] Normalize Text - Lower"
curl -s -X POST "$BASE_URL/tools/normalize-text/invoke" \
  -H "x-gateway-token: $GATEWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "input": { "text": "Hello World", "mode": "lower" },
    "context": { "scopes": ["text:transform"] }
  }' | jq '.'
echo ""

# Test 4: normalize-text tool (upper)
echo "[4] Normalize Text - Upper"
curl -s -X POST "$BASE_URL/tools/normalize-text/invoke" \
  -H "x-gateway-token: $GATEWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "input": { "text": "hello world", "mode": "upper" },
    "context": { "scopes": ["text:transform"] }
  }' | jq '.'
echo ""

# Test 5: normalize-text tool (title)
echo "[5] Normalize Text - Title"
curl -s -X POST "$BASE_URL/tools/normalize-text/invoke" \
  -H "x-gateway-token: $GATEWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "input": { "text": "hello world example", "mode": "title" },
    "context": { "scopes": ["text:transform"] }
  }' | jq '.'
echo ""

# Test 6: Tool not found
echo "[6] Tool Not Found (404)"
curl -s -X POST "$BASE_URL/tools/invalid-tool/invoke" \
  -H "x-gateway-token: $GATEWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"input": {}}' | jq '.'
echo ""

# Test 7: Missing required input
echo "[7] Validation Error - Missing Required Field (400)"
curl -s -X POST "$BASE_URL/tools/sum/invoke" \
  -H "x-gateway-token: $GATEWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "input": { "a": 5 },
    "context": {}
  }' | jq '.'
echo ""

# Test 8: Invalid enum value
echo "[8] Validation Error - Invalid Enum (400)"
curl -s -X POST "$BASE_URL/tools/normalize-text/invoke" \
  -H "x-gateway-token: $GATEWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "input": { "text": "test", "mode": "invalid" },
    "context": {}
  }' | jq '.'
echo ""

echo "=========================================="
echo "All tests complete!"
echo "=========================================="
