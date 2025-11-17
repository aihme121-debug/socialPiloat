# 🚨 Facebook OAuth "URL Blocked" - Complete Fix Guide

## Problem Summary
You're getting the error: **"URL blocked - This redirect failed because the redirect URI is not white-listed in the app's client OAuth settings."**

## 🔍 Root Cause Analysis

The issue occurs when Facebook doesn't recognize the redirect URI being used. This happens because:

1. **Redirect URI not added to Facebook app settings**
2. **App domains not configured**
3. **OAuth settings not enabled**
4. **URL mismatch (even trailing slashes matter)**

## 🛠️ Complete Solution

### Step 1: Get Your Current Configuration

First, let's check your current setup:

```bash
# Check your current configuration
curl http://localhost:3001/api/auth/social/facebook/debug?action=diagnostic
```

**Expected Redirect URI**: `https://mui-unpretentious-coextensively.ngrok-free.dev/api/auth/social/facebook/callback`

### Step 2: Configure Facebook App Settings

#### 🔗 Go to Facebook Developers
1. Visit: https://developers.facebook.com/apps/
2. Select your app (App ID: `2251494668686316`)

#### 📋 Configure Basic Settings
1. **Go to**: Settings → Basic
2. **Add App Domains**:
   ```
   localhost
   mui-unpretentious-coextensively.ngrok-free.dev
   ```
3. **Save Changes**

#### 🔐 Configure Facebook Login Settings
1. **Go to**: Facebook Login → Settings (in left sidebar)
2. **Add Valid OAuth Redirect URIs** (add ALL of these):
   ```
   https://mui-unpretentious-coextensively.ngrok-free.dev/api/auth/social/facebook/callback
   http://localhost:3000/api/auth/social/facebook/callback
   http://localhost:3001/api/auth/social/facebook/callback
   ```
3. **Enable Required Settings**:
   - ✅ Client OAuth Login: **Yes**
   - ✅ Web OAuth Login: **Yes**
   - ✅ Enforce HTTPS: **No** (for local development)
   - ✅ Embedded Browser OAuth Login: **Yes**
   - ✅ Use Strict Mode for Redirect URIs: **No**
4. **Save Changes**

### Step 3: Verify Configuration

Test your configuration:
```bash
# Generate test OAuth URL
curl http://localhost:3001/api/auth/social/facebook/debug?action=test-oauth
```

### Step 4: Test the Connection

1. **Visit**: http://localhost:3001/dashboard/social-accounts
2. **Click**: "Connect Facebook" button
3. **Expected Result**: Facebook login/authorization page (not "URL blocked" error)

## 🔧 Advanced Debugging

If still getting errors, check:

### 1. Facebook App Status
```bash
curl http://localhost:3001/api/auth/social/facebook/debug?action=check-app-status
```

### 2. Redirect URI Validation
```bash
curl http://localhost:3001/api/auth/social/facebook/debug?action=validate-redirect
```

### 3. OAuth URL Generation
```bash
curl http://localhost:3001/api/auth/social/facebook/debug?action=generate-url
```

## 🚨 Critical Requirements

### Exact URLs to Add to Facebook App:

**App Domains**:
```
localhost
mui-unpretentious-coextensively.ngrok-free.dev
```

**OAuth Redirect URIs**:
```
https://mui-unpretentious-coextensively.ngrok-free.dev/api/auth/social/facebook/callback
http://localhost:3000/api/auth/social/facebook/callback
http://localhost:3001/api/auth/social/facebook/callback
```

### Facebook App Settings Checklist:

- [ ] App is in **Development mode** (not Live)
- [ ] You are logged in as **App Admin/Developer**
- [ ] All redirect URIs added exactly as specified
- [ ] App domains configured
- [ ] Client OAuth Login: **Enabled**
- [ ] Web OAuth Login: **Enabled**
- [ ] Enforce HTTPS: **Disabled** (for local testing)

## 🎯 Quick Fix Checklist

1. **Copy the exact redirect URI**: `https://mui-unpretentious-coextensively.ngrok-free.dev/api/auth/social/facebook/callback`
2. **Go to Facebook Developers**: https://developers.facebook.com/apps/2251494668686316/settings/
3. **Add to Facebook Login → Settings → Valid OAuth Redirect URIs**
4. **Save changes**
5. **Test connection**: http://localhost:3001/dashboard/social-accounts

## 🐛 Common Issues & Solutions

### Issue 1: "URL blocked" still appears
**Solution**: 
- Double-check redirect URI is copied exactly (case-sensitive)
- Ensure no extra spaces or characters
- Try adding all localhost variants

### Issue 2: App not found
**Solution**:
- Ensure you're logged into Facebook as app admin
- Check app is in Development mode

### Issue 3: HTTPS requirements
**Solution**:
- For local development, disable "Enforce HTTPS"
- Ngrok provides HTTPS automatically

### Issue 4: Redirect URI mismatch
**Solution**:
- Check for trailing slashes (must match exactly)
- Verify protocol (http vs https)

## 📊 Verification Steps

After configuration:

1. **Test OAuth URL**: Visit `http://localhost:3001/api/auth/social/facebook`
2. **Expected**: Redirects to Facebook login page
3. **If successful**: You'll see Facebook authorization screen
4. **If still blocked**: Recheck Facebook app settings

## 🚀 Alternative Testing Method

If web interface fails, test directly:
```bash
# Get test OAuth URL
curl -s http://localhost:3001/api/auth/social/facebook/debug?action=test-oauth | jq -r .testAuthUrl
```

Copy the resulting URL and paste in browser. If it shows Facebook login, your configuration is working.

## 📞 Need Help?

If still having issues:
1. Check Facebook app reviews/requirements
2. Ensure app is not in Live mode while testing
3. Verify all environment variables are set correctly
4. Check ngrok is running: http://localhost:4040

## ✅ Success Indicators

When working correctly:
- Facebook shows login/authorization page (not "URL blocked")
- You can authorize your app
- Redirect back to your application works
- Social account appears in dashboard

---

**Your ngrok URL**: `https://mui-unpretentious-coextensively.ngrok-free.dev`
**Your redirect URI**: `https://mui-unpretentious-coextensively.ngrok-free.dev/api/auth/social/facebook/callback`
**Facebook App ID**: `2251494668686316`

Follow these steps exactly and your Facebook OAuth will work! 🎉