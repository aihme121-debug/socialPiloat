# Facebook App Setup Guide - Fix App Domains Error

## 🚨 APP DOMAINS ERROR SOLUTION

The error "App domains must match the domain of the Facebook Web Games URL (https), Mobile site URL, Unity binary URL, Site URL or Secure Page Tab URL" occurs because Facebook requires that app domains must match one of the configured platform URLs.

## ✅ STEP-BY-STEP FIX

### Step 1: Configure Facebook App Settings

1. **Go to Facebook Developer Console:**
   - Visit: https://developers.facebook.com/apps/2251494668686316/settings/basic/
   - Make sure you're logged in as the app admin

2. **Add Platform (CRITICAL STEP):**
   - Scroll down to "Add Platform"
   - Click "Add Platform" button
   - Select **"Website"**
   - In the **Site URL** field, enter: `https://mui-unpretentious-coextensively.ngrok-free.dev`
   - Save changes

3. **Configure App Domains (AFTER adding platform):**
   - In "App Domains" field, add:
     ```
     mui-unpretentious-coextensively.ngrok-free.dev
     localhost
     ```

### Step 2: Configure Facebook Login Settings

1. **Go to Facebook Login Settings:**
   - Navigate to: https://developers.facebook.com/apps/2251494668686316/facebook-login/settings/

2. **Configure OAuth Settings:**
   - **Client OAuth Login:** Yes ✓
   - **Web OAuth Login:** Yes ✓
   - **Enforce HTTPS:** No (for development)
   - **Use Strict Mode for Redirect URIs:** No (for development)

3. **Add Valid OAuth Redirect URIs:**
   Add these exact URLs (one per line):
   ```
   https://mui-unpretentious-coextensively.ngrok-free.dev/api/oauth/social/facebook/callback
   http://localhost:3000/api/oauth/social/facebook/callback
   http://localhost:3001/api/oauth/social/facebook/callback
   http://localhost:3002/api/oauth/social/facebook/callback
   ```

### Step 3: Additional Settings

1. **App Mode:**
   - Ensure your app is in **Development mode** (not Live)
   - You can find this toggle at the top of the app dashboard

2. **Business Verification (if needed):**
   - If you see business verification requirements, you can skip this for now
   - Development mode apps don't require immediate verification

## 🧪 TESTING THE CONFIGURATION

After completing the setup:

1. **Visit your social accounts page:**
   ```
   https://mui-unpretentious-coextensively.ngrok-free.dev/dashboard/social-accounts
   ```

2. **Click "Connect Account" for Facebook**

3. **Expected behavior:**
   - You should be redirected to Facebook login
   - After login, you should see a permission request
   - You should be redirected back to your app

## 🚨 TROUBLESHOOTING

### If "localhost" still doesn't work in App Domains:

**Option 1: Use only ngrok domain (recommended)**
- Remove `localhost` from App Domains
- Keep only: `mui-unpretentious-coextensively.ngrok-free.dev`
- Test only through the ngrok URL

**Option 2: Add localhost platform**
- Add another platform: **"Website"**
- Set Site URL to: `http://localhost:3002`
- Then add `localhost` to App Domains

### If you still get "URL blocked":

1. **Double-check redirect URIs:**
   - Make sure all 4 redirect URIs are added exactly as shown
   - Check for any typos or missing characters

2. **Check app status:**
   - Ensure app is in Development mode
   - Ensure you're logged in as app admin

3. **Clear browser cache:**
   - Clear cookies and cache
   - Try incognito/private browsing mode

## ✅ VERIFICATION

Once configured correctly, test with:
```bash
# Test OAuth flow
curl -I "https://mui-unpretentious-coextensively.ngrok-free.dev/api/oauth/social/facebook"
```

You should get a redirect to Facebook instead of the "URL blocked" error.

## 📋 SUMMARY

The key to fixing the App Domains error is:
1. **Add Website platform first**
2. **Set Site URL to your ngrok domain**
3. **Then add App Domains**
4. **Configure OAuth redirect URIs**

This should resolve both the App Domains error and the URL blocked error!