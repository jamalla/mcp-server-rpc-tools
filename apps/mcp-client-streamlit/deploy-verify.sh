#!/bin/bash
# Streamlit Deployment Verification Script
# Run this before deploying to Streamlit Cloud
# Usage: bash apps/mcp-client-streamlit/deploy-verify.sh

echo "🚀 Streamlit Deployment Verification"
echo "======================================"
echo ""

ERRORS=0
WARNINGS=0

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "1️⃣  Checking Git Status..."
if git status --porcelain | grep -q .; then
    echo -e "${RED}✗ Uncommitted changes detected${NC}"
    git status --porcelain
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✓ Git working tree clean${NC}"
fi
echo ""

echo "2️⃣  Checking Branch..."
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" = "main" ]; then
    echo -e "${GREEN}✓ On main branch${NC}"
else
    echo -e "${YELLOW}⚠ On branch: $BRANCH (expected: main)${NC}"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

echo "3️⃣  Checking Remote..."
if git fetch origin main 2>/dev/null && git merge-base --is-ancestor HEAD origin/main; then
    echo -e "${GREEN}✓ Repository up-to-date with origin${NC}"
else
    echo -e "${RED}✗ Local branch behind origin${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

echo "4️⃣  Checking Streamlit App..."
if [ -f "apps/mcp-client-streamlit/app.py" ]; then
    echo -e "${GREEN}✓ app.py exists${NC}"
    
    # Check for imports
    if grep -q "import streamlit as st" apps/mcp-client-streamlit/app.py; then
        echo -e "${GREEN}✓ Streamlit imported${NC}"
    else
        echo -e "${RED}✗ Streamlit not imported${NC}"
        ERRORS=$((ERRORS + 1))
    fi
    
    # Check for default gateway URL
    if grep -q "mcp-gateway-worker.to-jamz.workers.dev" apps/mcp-client-streamlit/app.py; then
        echo -e "${GREEN}✓ Production gateway URL configured${NC}"
    else
        echo -e "${YELLOW}⚠ Gateway URL might not be production${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${RED}✗ app.py not found${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

echo "5️⃣  Checking requirements.txt..."
if [ -f "apps/mcp-client-streamlit/requirements.txt" ]; then
    echo -e "${GREEN}✓ requirements.txt exists${NC}"
    
    # Check for key packages
    PACKAGES=("streamlit" "requests" "langchain" "langchain-groq" "langchain-core")
    for pkg in "${PACKAGES[@]}"; do
        if grep -q "$pkg" apps/mcp-client-streamlit/requirements.txt; then
            echo -e "${GREEN}  ✓ $pkg${NC}"
        else
            echo -e "${RED}  ✗ $pkg missing${NC}"
            ERRORS=$((ERRORS + 1))
        fi
    done
else
    echo -e "${RED}✗ requirements.txt not found${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

echo "6️⃣  Checking .streamlit config..."
if [ -f "apps/mcp-client-streamlit/.streamlit/config.toml" ]; then
    echo -e "${GREEN}✓ config.toml exists${NC}"
else
    echo -e "${YELLOW}⚠ config.toml not found (optional)${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

if [ -f "apps/mcp-client-streamlit/.streamlit/secrets.toml" ]; then
    echo -e "${GREEN}✓ secrets.toml exists (local dev)${NC}"
    
    # Make sure it's in gitignore
    if grep -q ".streamlit/secrets.toml" .gitignore 2>/dev/null; then
        echo -e "${GREEN}✓ secrets.toml in .gitignore${NC}"
    else
        echo -e "${YELLOW}⚠ secrets.toml should be in .gitignore${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${YELLOW}⚠ secrets.toml not found (only needed for local dev)${NC}"
fi
echo ""

echo "7️⃣  Checking Documentation..."
DOCS=("README.md" "QUICKSTART.md" "ARCHITECTURE.md" "PROJECT_MANIFEST.md" "STREAMLIT_DEPLOYMENT.md")
for doc in "${DOCS[@]}"; do
    if [ -f "$doc" ]; then
        echo -e "${GREEN}✓ $doc${NC}"
    else
        echo -e "${YELLOW}⚠ $doc missing${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
done
echo ""

echo "8️⃣  Checking .gitignore..."
if grep -q "node_modules" .gitignore 2>/dev/null; then
    echo -e "${GREEN}✓ .gitignore configured${NC}"
else
    echo -e "${YELLOW}⚠ .gitignore might be incomplete${NC}"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

echo "======================================"
echo "📊 Verification Summary"
echo "======================================"
echo -e "Errors: ${RED}$ERRORS${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
echo ""

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Go to https://share.streamlit.io"
    echo "2. Sign in with GitHub"
    echo "3. Click 'New app'"
    echo "4. Select jamalla/mcp-server-rpc-tools"
    echo "5. Set main file path: apps/mcp-client-streamlit/app.py"
    echo "6. Click 'Deploy'"
    echo ""
    echo "Your app will be live in 2-3 minutes! 🚀"
    exit 0
else
    echo -e "${RED}❌ Fix errors before deploying${NC}"
    exit 1
fi
