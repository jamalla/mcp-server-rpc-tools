# Streamlit Deployment Verification Script (PowerShell)
# Run this before deploying to Streamlit Cloud
# Usage: .\apps\mcp-client-streamlit\deploy-verify.ps1

Write-Host "🚀 Streamlit Deployment Verification" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""

$ERRORS = 0
$WARNINGS = 0

Write-Host "1️⃣  Checking Git Status..."
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "✗ Uncommitted changes detected" -ForegroundColor Red
    $gitStatus
    $ERRORS++
} else {
    Write-Host "✓ Git working tree clean" -ForegroundColor Green
}
Write-Host ""

Write-Host "2️⃣  Checking Branch..."
$branch = git rev-parse --abbrev-ref HEAD
if ($branch -eq "main") {
    Write-Host "✓ On main branch" -ForegroundColor Green
} else {
    Write-Host "⚠ On branch: $branch (expected: main)" -ForegroundColor Yellow
    $WARNINGS++
}
Write-Host ""

Write-Host "3️⃣  Checking Remote..."
git fetch origin main 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Repository up-to-date with origin" -ForegroundColor Green
} else {
    Write-Host "✗ Connection to origin failed" -ForegroundColor Red
    $ERRORS++
}
Write-Host ""

Write-Host "4️⃣  Checking Streamlit App..."
$appPath = "apps/mcp-client-streamlit/app.py"
if (Test-Path $appPath) {
    Write-Host "✓ app.py exists" -ForegroundColor Green
    
    $content = Get-Content $appPath -Raw
    if ($content -match "import streamlit as st") {
        Write-Host "✓ Streamlit imported" -ForegroundColor Green
    } else {
        Write-Host "✗ Streamlit not imported" -ForegroundColor Red
        $ERRORS++
    }
    
    if ($content -match "mcp-gateway-worker.to-jamz.workers.dev") {
        Write-Host "✓ Production gateway URL configured" -ForegroundColor Green
    } else {
        Write-Host "⚠ Gateway URL might not be production" -ForegroundColor Yellow
        $WARNINGS++
    }
} else {
    Write-Host "✗ app.py not found" -ForegroundColor Red
    $ERRORS++
}
Write-Host ""

Write-Host "5️⃣  Checking requirements.txt..."
$reqPath = "apps/mcp-client-streamlit/requirements.txt"
if (Test-Path $reqPath) {
    Write-Host "✓ requirements.txt exists" -ForegroundColor Green
    
    $packages = @("streamlit", "requests", "langchain", "langchain-groq", "langchain-core")
    $reqContent = Get-Content $reqPath -Raw
    foreach ($pkg in $packages) {
        if ($reqContent -match $pkg) {
            Write-Host "  ✓ $pkg" -ForegroundColor Green
        } else {
            Write-Host "  ✗ $pkg missing" -ForegroundColor Red
            $ERRORS++
        }
    }
} else {
    Write-Host "✗ requirements.txt not found" -ForegroundColor Red
    $ERRORS++
}
Write-Host ""

Write-Host "6️⃣  Checking .streamlit config..."
$configPath = "apps/mcp-client-streamlit/.streamlit/config.toml"
if (Test-Path $configPath) {
    Write-Host "✓ config.toml exists" -ForegroundColor Green
} else {
    Write-Host "⚠ config.toml not found (optional)" -ForegroundColor Yellow
    $WARNINGS++
}

$secretsPath = "apps/mcp-client-streamlit/.streamlit/secrets.toml"
if (Test-Path $secretsPath) {
    Write-Host "✓ secrets.toml exists (local dev)" -ForegroundColor Green
    
    $gitignore = Get-Content ".gitignore" -Raw -ErrorAction SilentlyContinue
    if ($gitignore -match ".streamlit/secrets.toml") {
        Write-Host "✓ secrets.toml in .gitignore" -ForegroundColor Green
    } else {
        Write-Host "⚠ secrets.toml should be in .gitignore" -ForegroundColor Yellow
        $WARNINGS++
    }
} else {
    Write-Host "⚠ secrets.toml not found (only needed for local dev)" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "7️⃣  Checking Documentation..."
$docs = @("README.md", "QUICKSTART.md", "ARCHITECTURE.md", "PROJECT_MANIFEST.md", "STREAMLIT_DEPLOYMENT.md")
foreach ($doc in $docs) {
    if (Test-Path $doc) {
        Write-Host "✓ $doc" -ForegroundColor Green
    } else {
        Write-Host "⚠ $doc missing" -ForegroundColor Yellow
        $WARNINGS++
    }
}
Write-Host ""

Write-Host "8️⃣  Checking .gitignore..."
$gitignore = Get-Content ".gitignore" -Raw -ErrorAction SilentlyContinue
if ($gitignore -match "node_modules") {
    Write-Host "✓ .gitignore configured" -ForegroundColor Green
} else {
    Write-Host "⚠ .gitignore might be incomplete" -ForegroundColor Yellow
    $WARNINGS++
}
Write-Host ""

Write-Host "======================================" -ForegroundColor Green
Write-Host "📊 Verification Summary" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host "Errors: $ERRORS" -ForegroundColor $(if ($ERRORS -gt 0) { "Red" } else { "Green" })
Write-Host "Warnings: $WARNINGS" -ForegroundColor $(if ($WARNINGS -gt 0) { "Yellow" } else { "Green" })
Write-Host ""

if ($ERRORS -eq 0) {
    Write-Host "✅ All checks passed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Go to https://share.streamlit.io" -ForegroundColor Cyan
    Write-Host "2. Sign in with GitHub" -ForegroundColor Cyan
    Write-Host "3. Click 'New app'" -ForegroundColor Cyan
    Write-Host "4. Select jamalla/mcp-server-rpc-tools" -ForegroundColor Cyan
    Write-Host "5. Set main file path: apps/mcp-client-streamlit/app.py" -ForegroundColor Cyan
    Write-Host "6. Click 'Deploy'" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Your app will be live in 2-3 minutes! 🚀" -ForegroundColor Green
    exit 0
} else {
    Write-Host "❌ Fix errors before deploying" -ForegroundColor Red
    exit 1
}
