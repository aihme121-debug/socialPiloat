# Ngrok setup script for SocialPilot webhook configuration

Write-Host "Setting up ngrok for SocialPilot webhooks..." -ForegroundColor Green

# Check if ngrok is running
$ngrokStatus = Get-Process -Name "ngrok" -ErrorAction SilentlyContinue

if ($ngrokStatus) {
    Write-Host "Ngrok is already running. Getting tunnel information..." -ForegroundColor Yellow
} else {
    Write-Host "Starting ngrok..." -ForegroundColor Yellow
    Start-Process -FilePath "ngrok" -ArgumentList "http", "3001" -NoNewWindow -PassThru
    Start-Sleep -Seconds 3
}

# Get ngrok tunnel information
try {
    $tunnels = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -Method Get -TimeoutSec 5
    
    if ($tunnels.tunnels.Count -gt 0) {
        $publicUrl = $tunnels.tunnels[0].public_url
        Write-Host "Ngrok tunnel established: $publicUrl" -ForegroundColor Green
        
        # Update environment file
        $envFile = ".env.local"
        $envContent = Get-Content $envFile
        
        # Update Facebook redirect URI
        $facebookRedirect = "$publicUrl/api/auth/social/facebook/callback"
        $facebookWebhook = "$publicUrl/api/facebook/webhook"
        
        # Replace existing ngrok URLs
        $envContent = $envContent -replace 'FACEBOOK_REDIRECT_URI=https://.*\.ngrok-free\.dev/api/facebook/oauth/callback', "FACEBOOK_REDIRECT_URI=$facebookRedirect"
        $envContent = $envContent -replace 'FACEBOOK_WEBHOOK_CALLBACK_URL=https://.*\.ngrok-free\.dev/api/facebook/webhook', "FACEBOOK_WEBHOOK_CALLBACK_URL=$facebookWebhook"
        
        # Add other social media callback URLs
        $instagramRedirect = "$publicUrl/api/auth/social/instagram/callback"
        $twitterRedirect = "$publicUrl/api/auth/social/twitter/callback"
        $linkedinRedirect = "$publicUrl/api/auth/social/linkedin/callback"
        
        # Check if these lines exist, if not add them
        if ($envContent -notmatch 'INSTAGRAM_REDIRECT_URI') {
            $envContent += "`nINSTAGRAM_REDIRECT_URI=$instagramRedirect"
        } else {
            $envContent = $envContent -replace 'INSTAGRAM_REDIRECT_URI=https://.*\.ngrok-free\.dev/api/auth/social/instagram/callback', "INSTAGRAM_REDIRECT_URI=$instagramRedirect"
        }
        
        if ($envContent -notmatch 'TWITTER_REDIRECT_URI') {
            $envContent += "`nTWITTER_REDIRECT_URI=$twitterRedirect"
        } else {
            $envContent = $envContent -replace 'TWITTER_REDIRECT_URI=https://.*\.ngrok-free\.dev/api/auth/social/twitter/callback', "TWITTER_REDIRECT_URI=$twitterRedirect"
        }
        
        if ($envContent -notmatch 'LINKEDIN_REDIRECT_URI') {
            $envContent += "`nLINKEDIN_REDIRECT_URI=$linkedinRedirect"
        } else {
            $envContent = $envContent -replace 'LINKEDIN_REDIRECT_URI=https://.*\.ngrok-free\.dev/api/auth/social/linkedin/callback', "LINKEDIN_REDIRECT_URI=$linkedinRedirect"
        }
        
        # Update NEXTAUTH_URL for production
        if ($envContent -notmatch 'NEXTAUTH_URL_PRODUCTION') {
            $envContent += "`nNEXTAUTH_URL_PRODUCTION=$publicUrl"
        } else {
            $envContent = $envContent -replace 'NEXTAUTH_URL_PRODUCTION=https://.*\.ngrok-free\.dev', "NEXTAUTH_URL_PRODUCTION=$publicUrl"
        }
        
        Set-Content -Path $envFile -Value $envContent
        
        Write-Host "Updated environment file with ngrok URLs:" -ForegroundColor Green
        Write-Host "  Facebook Redirect: $facebookRedirect" -ForegroundColor Cyan
        Write-Host "  Facebook Webhook: $facebookWebhook" -ForegroundColor Cyan
        Write-Host "  Instagram Redirect: $instagramRedirect" -ForegroundColor Cyan
        Write-Host "  Twitter Redirect: $twitterRedirect" -ForegroundColor Cyan
        Write-Host "  LinkedIn Redirect: $linkedinRedirect" -ForegroundColor Cyan
        Write-Host "  NextAuth URL: $publicUrl" -ForegroundColor Cyan
        
        Write-Host "`n⚠️  Important: Restart your Next.js development server to apply changes!" -ForegroundColor Yellow
        Write-Host "   Run: npm run dev" -ForegroundColor Yellow
        
    } else {
        Write-Host "No active ngrok tunnels found. Please check ngrok status." -ForegroundColor Red
    }
    
} catch {
    Write-Host "Error connecting to ngrok API. Make sure ngrok is running." -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host "`nTo start ngrok manually, run: ngrok http 3001" -ForegroundColor Yellow
}

Write-Host "`nSetup complete!" -ForegroundColor Green