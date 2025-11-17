# Facebook OAuth Configuration Fixer
# This script helps diagnose and fix Facebook OAuth redirect URI issues

Write-Host "🔧 Facebook OAuth Configuration Fixer" -ForegroundColor Blue
Write-Host "=======================================" -ForegroundColor Blue

# Function to test if a URL is accessible
function Test-UrlAccessibility {
    param([string]$url)
    try {
        $response = Invoke-WebRequest -Uri $url -Method HEAD -TimeoutSec 5 -UseBasicParsing
        return $true
    } catch {
        return $false
    }
}

# Function to get environment variable
function Get-EnvVar {
    param([string]$name)
    return [System.Environment]::GetEnvironmentVariable($name) ?? (Get-Content .env.local | Select-String "^$name=" | ForEach-Object { $_.ToString().Split('=')[1] })
}

Write-Host "`n📋 Checking current configuration..." -ForegroundColor Yellow

# Get current configuration
$appId = Get-EnvVar "FACEBOOK_APP_ID"
$redirectUri = Get-EnvVar "FACEBOOK_REDIRECT_URI"
$ngrokUrl = Get-EnvVar "NGROK_URL"
$nextauthUrl = Get-EnvVar "NEXTAUTH_URL"
$nextauthProductionUrl = Get-EnvVar "NEXTAUTH_URL_PRODUCTION"

Write-Host "Current Configuration:" -ForegroundColor Green
Write-Host "  App ID: $appId" -ForegroundColor Cyan
Write-Host "  Redirect URI: $redirectUri" -ForegroundColor Cyan
Write-Host "  Ngrok URL: $ngrokUrl" -ForegroundColor Cyan
Write-Host "  NextAuth URL: $nextauthUrl" -ForegroundColor Cyan
Write-Host "  NextAuth Production URL: $nextauthProductionUrl" -ForegroundColor Cyan

Write-Host "`n🔍 Validating configuration..." -ForegroundColor Yellow

# Validation checks
$issues = @()

if ([string]::IsNullOrEmpty($appId)) {
    $issues += "❌ FACEBOOK_APP_ID is not set"
} else {
    Write-Host "✅ FACEBOOK_APP_ID is configured" -ForegroundColor Green
}

if ([string]::IsNullOrEmpty($redirectUri)) {
    $issues += "❌ FACEBOOK_REDIRECT_URI is not set"
} else {
    Write-Host "✅ FACEBOOK_REDIRECT_URI is configured" -ForegroundColor Green
}

if ($redirectUri -notlike "*/api/auth/social/facebook/callback") {
    $issues += "❌ Redirect URI format is incorrect. Should end with /api/auth/social/facebook/callback"
} else {
    Write-Host "✅ Redirect URI format is correct" -ForegroundColor Green
}

# Test URL accessibility
Write-Host "`n🌐 Testing URL accessibility..." -ForegroundColor Yellow

if (Test-UrlAccessibility $redirectUri) {
    Write-Host "✅ Redirect URI is accessible" -ForegroundColor Green
} else {
    $issues += "⚠️  Redirect URI may not be accessible from internet"
}

if (Test-UrlAccessibility "$ngrokUrl/api/auth/social/facebook/callback") {
    Write-Host "✅ Ngrok callback URL is accessible" -ForegroundColor Green
} else {
    $issues += "⚠️  Ngrok callback URL may not be accessible"
}

# Show issues
if ($issues.Count -gt 0) {
    Write-Host "`n❌ Issues found:" -ForegroundColor Red
    foreach ($issue in $issues) {
        Write-Host "  $issue" -ForegroundColor Red
    }
} else {
    Write-Host "`n✅ No configuration issues found!" -ForegroundColor Green
}

Write-Host "`n📋 Facebook App Settings Required:" -ForegroundColor Yellow
Write-Host "Go to: https://developers.facebook.com/apps/$appId/settings/" -ForegroundColor Blue

Write-Host "`n1. App Domains (Settings → Basic):" -ForegroundColor Cyan
$appDomains = @(
    "localhost",
    ($ngrokUrl -replace "https?://", "")
)
foreach ($domain in $appDomains) {
    if (![string]::IsNullOrEmpty($domain)) {
        Write-Host "   - $domain" -ForegroundColor White
    }
}

Write-Host "`n2. OAuth Redirect URIs (Facebook Login → Settings):" -ForegroundColor Cyan
$redirectUris = @(
    $redirectUri,
    "http://localhost:3000/api/auth/social/facebook/callback",
    "$ngrokUrl/api/auth/social/facebook/callback"
)
foreach ($uri in $redirectUris) {
    if (![string]::IsNullOrEmpty($uri)) {
        Write-Host "   - $uri" -ForegroundColor White
    }
}

Write-Host "`n3. Required Settings:" -ForegroundColor Cyan
Write-Host "   - Client OAuth Login: Yes" -ForegroundColor White
Write-Host "   - Web OAuth Login: Yes" -ForegroundColor White
Write-Host "   - Enforce HTTPS: No (for local development)" -ForegroundColor White
Write-Host "   - Embedded Browser OAuth Login: Yes" -ForegroundColor White
Write-Host "   - Use Strict Mode for Redirect URIs: No" -ForegroundColor White

Write-Host "`n🧪 Test URLs:" -ForegroundColor Yellow
Write-Host "Direct OAuth Test: $ngrokUrl/api/auth/social/facebook" -ForegroundColor Blue
Write-Host "Expected Callback: $redirectUri" -ForegroundColor Blue

Write-Host "`n🔧 Quick Fix Commands:" -ForegroundColor Yellow
Write-Host "# If ngrok URL changes, update environment:" -ForegroundColor Gray
Write-Host "# 1. Update .env.local with new NGROK_URL" -ForegroundColor White
Write-Host "# 2. Run: powershell -ExecutionPolicy Bypass -File scripts/setup-ngrok.ps1" -ForegroundColor White
Write-Host "# 3. Restart your Next.js development server" -ForegroundColor White

Write-Host "`n📚 Troubleshooting Tips:" -ForegroundColor Yellow
Write-Host "1. Ensure you're logged into Facebook as the app admin/developer" -ForegroundColor White
Write-Host "2. App must be in Development mode for testing" -ForegroundColor White
Write-Host "3. Redirect URIs must match EXACTLY (including trailing slashes)" -ForegroundColor White
Write-Host "4. Test with localhost first, then ngrok" -ForegroundColor White
Write-Host "5. Check Facebook app reviews if in production" -ForegroundColor White

Write-Host "`n✨ Setup Dashboard:" -ForegroundColor Green
Write-Host "Visit: http://localhost:3001/dashboard/facebook-setup" -ForegroundColor Blue
Write-Host "This provides a visual interface for configuration steps" -ForegroundColor Gray

Write-Host "`n=======================================" -ForegroundColor Blue
Write-Host "Configuration check complete!" -ForegroundColor Blue

# Return success/failure
if ($issues.Count -eq 0) {
    exit 0
} else {
    exit 1
}