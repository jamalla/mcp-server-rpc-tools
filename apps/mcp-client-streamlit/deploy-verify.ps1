# Streamlit Deployment Verification Script (PowerShell)
# Usage: .\apps\mcp-client-streamlit\deploy-verify.ps1

$errors = 0
$warnings = 0

Write-Host "Streamlit Deployment Verification" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""

Write-Host "1) Checking Git Status..."
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "FAIL Uncommitted changes detected" -ForegroundColor Red
    $gitStatus
    $errors++
} else {
    Write-Host "OK Git working tree clean" -ForegroundColor Green
}
Write-Host ""

Write-Host "2) Checking Branch..."
$branch = git rev-parse --abbrev-ref HEAD
if ($branch -eq "main") {
    Write-Host "OK On main branch" -ForegroundColor Green
} else {
    Write-Host "WARN On branch: $branch (expected: main)" -ForegroundColor Yellow
    $warnings++
}
Write-Host ""

Write-Host "3) Checking Remote..."
git fetch origin main 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "OK Repository reachable" -ForegroundColor Green
} else {
    Write-Host "FAIL Connection to origin failed" -ForegroundColor Red
    $errors++
}
Write-Host ""

Write-Host "4) Checking Streamlit App..."
$appPath = "apps/mcp-client-streamlit/app.py"
if (Test-Path $appPath) {
    Write-Host "OK app.py exists" -ForegroundColor Green
    $content = Get-Content $appPath -Raw

    if ($content -match "import streamlit as st") {
        Write-Host "OK Streamlit imported" -ForegroundColor Green
    } else {
        Write-Host "FAIL Streamlit import missing" -ForegroundColor Red
        $errors++
    }

    if ($content -match "mcp-gateway-worker.to-jamz.workers.dev") {
        Write-Host "OK Production gateway URL configured" -ForegroundColor Green
    } else {
        Write-Host "WARN Gateway URL might not be production" -ForegroundColor Yellow
        $warnings++
    }
} else {
    Write-Host "FAIL app.py not found" -ForegroundColor Red
    $errors++
}
Write-Host ""

Write-Host "5) Checking requirements.txt..."
$reqPath = "apps/mcp-client-streamlit/requirements.txt"
if (Test-Path $reqPath) {
    Write-Host "OK requirements.txt exists" -ForegroundColor Green
    $reqContent = Get-Content $reqPath -Raw
    $packages = @("streamlit", "requests", "langchain", "langchain-groq", "langchain-core")
    foreach ($pkg in $packages) {
        if ($reqContent -match [regex]::Escape($pkg)) {
            Write-Host "  OK $pkg" -ForegroundColor Green
        } else {
            Write-Host "  FAIL $pkg missing" -ForegroundColor Red
            $errors++
        }
    }
} else {
    Write-Host "FAIL requirements.txt not found" -ForegroundColor Red
    $errors++
}
Write-Host ""

Write-Host "6) Checking .streamlit config..."
$configPath = "apps/mcp-client-streamlit/.streamlit/config.toml"
if (Test-Path $configPath) {
    Write-Host "OK config.toml exists" -ForegroundColor Green
} else {
    Write-Host "WARN config.toml not found (optional)" -ForegroundColor Yellow
    $warnings++
}

$secretsPath = "apps/mcp-client-streamlit/.streamlit/secrets.toml"
if (Test-Path $secretsPath) {
    Write-Host "OK secrets.toml exists (local dev)" -ForegroundColor Green
    $gitignore = Get-Content ".gitignore" -Raw -ErrorAction SilentlyContinue
    if ($gitignore -match "\.streamlit/secrets.toml") {
        Write-Host "OK secrets.toml is ignored" -ForegroundColor Green
    } else {
        Write-Host "WARN secrets.toml should be in .gitignore" -ForegroundColor Yellow
        $warnings++
    }
} else {
    Write-Host "WARN secrets.toml not found (optional for local dev)" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "7) Checking docs files..."
$docs = @("README.md", "ARCHITECTURE.md", "STREAMLIT_DEPLOYMENT.md")
foreach ($doc in $docs) {
    if (Test-Path $doc) {
        Write-Host "OK $doc" -ForegroundColor Green
    } else {
        Write-Host "WARN $doc missing" -ForegroundColor Yellow
        $warnings++
    }
}
Write-Host ""

Write-Host "8) Checking .gitignore..."
$gitignore = Get-Content ".gitignore" -Raw -ErrorAction SilentlyContinue
if ($gitignore -match "node_modules") {
    Write-Host "OK .gitignore has node_modules" -ForegroundColor Green
} else {
    Write-Host "WARN .gitignore might be incomplete" -ForegroundColor Yellow
    $warnings++
}
Write-Host ""

Write-Host "================================" -ForegroundColor Green
Write-Host "Summary" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host "Errors: $errors" -ForegroundColor $(if ($errors -gt 0) { "Red" } else { "Green" })
Write-Host "Warnings: $warnings" -ForegroundColor $(if ($warnings -gt 0) { "Yellow" } else { "Green" })
Write-Host ""

if ($errors -eq 0) {
    Write-Host "PASS Ready for Streamlit Cloud deploy" -ForegroundColor Green
    Write-Host "Open https://share.streamlit.io and deploy main file: apps/mcp-client-streamlit/app.py" -ForegroundColor Cyan
    exit 0
} else {
    Write-Host "FAIL Resolve errors before deploy" -ForegroundColor Red
    exit 1
}
