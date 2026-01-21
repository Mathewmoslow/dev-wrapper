# Audit script for studiora-dev setup
# Run from project directory: .\audit.ps1

Write-Host "`n=== STUDIORA-DEV SETUP AUDIT ===" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

# Check current directory
Write-Host "1. CURRENT DIRECTORY" -ForegroundColor Yellow
Write-Host "   Path: $(Get-Location)"
Write-Host ""

# Check if .git exists
Write-Host "2. GIT STATUS" -ForegroundColor Yellow
if (Test-Path ".git") {
    Write-Host "   .git folder: EXISTS" -ForegroundColor Green

    # Get remote URL
    $remoteUrl = git remote get-url origin 2>$null
    if ($remoteUrl) {
        Write-Host "   Remote URL: $remoteUrl" -ForegroundColor Green
    } else {
        Write-Host "   Remote URL: NOT SET" -ForegroundColor Red
    }

    # Get branch
    $branch = git branch --show-current 2>$null
    Write-Host "   Branch: $branch"

    # Check commits
    $commitCount = git rev-list --count HEAD 2>$null
    Write-Host "   Commits: $commitCount"

    # Check if pushed
    $pushed = git log origin/$branch..HEAD --oneline 2>$null
    if ($pushed) {
        Write-Host "   Unpushed commits: YES" -ForegroundColor Yellow
    } else {
        Write-Host "   Pushed to remote: YES" -ForegroundColor Green
    }
} else {
    Write-Host "   .git folder: NOT FOUND" -ForegroundColor Red
}
Write-Host ""

# Check .vercel folder
Write-Host "3. VERCEL STATUS" -ForegroundColor Yellow
if (Test-Path ".vercel") {
    Write-Host "   .vercel folder: EXISTS" -ForegroundColor Green

    if (Test-Path ".vercel/project.json") {
        Write-Host "   project.json:" -ForegroundColor Green
        $projectJson = Get-Content ".vercel/project.json" | ConvertFrom-Json
        Write-Host "      orgId: $($projectJson.orgId)"
        Write-Host "      projectId: $($projectJson.projectId)"
    }
} else {
    Write-Host "   .vercel folder: NOT FOUND" -ForegroundColor Red
}
Write-Host ""

# Check GitHub CLI
Write-Host "4. GITHUB CLI" -ForegroundColor Yellow
$ghVersion = gh --version 2>$null | Select-Object -First 1
if ($ghVersion) {
    Write-Host "   Version: $ghVersion" -ForegroundColor Green

    $ghUser = gh api user --jq '.login' 2>$null
    Write-Host "   Logged in as: $ghUser" -ForegroundColor Green

    # Check if repo exists on GitHub
    if ($remoteUrl) {
        $repoName = $remoteUrl -replace '.*github.com[:/]' -replace '\.git$'
        Write-Host "   Checking repo: $repoName"
        $repoInfo = gh repo view $repoName --json name,visibility,url 2>$null | ConvertFrom-Json
        if ($repoInfo) {
            Write-Host "      Name: $($repoInfo.name)" -ForegroundColor Green
            Write-Host "      Visibility: $($repoInfo.visibility)" -ForegroundColor Green
            Write-Host "      URL: $($repoInfo.url)" -ForegroundColor Green
        } else {
            Write-Host "      Repo NOT FOUND on GitHub" -ForegroundColor Red
        }
    }
} else {
    Write-Host "   gh CLI: NOT INSTALLED" -ForegroundColor Red
}
Write-Host ""

# Check Vercel CLI
Write-Host "5. VERCEL CLI" -ForegroundColor Yellow
$vercelVersion = vercel --version 2>$null
if ($vercelVersion) {
    Write-Host "   Version: $vercelVersion" -ForegroundColor Green

    # Check vercel whoami
    $vercelUser = vercel whoami 2>$null
    Write-Host "   Logged in as: $vercelUser" -ForegroundColor Green
} else {
    Write-Host "   vercel CLI: NOT INSTALLED" -ForegroundColor Red
}
Write-Host ""

# List files
Write-Host "6. PROJECT FILES" -ForegroundColor Yellow
Get-ChildItem -Force | ForEach-Object {
    $icon = if ($_.PSIsContainer) { "[DIR]" } else { "[FILE]" }
    Write-Host "   $icon $($_.Name)"
}
Write-Host ""

# Summary
Write-Host "=== SUMMARY ===" -ForegroundColor Cyan
Write-Host "Run this after 'studiora-dev --new' to diagnose issues."
Write-Host "Share this output when reporting problems.`n"
