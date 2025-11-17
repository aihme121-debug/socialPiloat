# Facebook Live Mode OAuth Configuration Guide

## 🚨 LIVE MODE REQUIREMENTS

Since your Facebook app is in **Live mode**, there are strict requirements:
- ✅ **HTTPS is enforced** (cannot be turned off)
- ✅ **Strict Mode for Redirect URIs** is required
- ✅ **Business verification** may be required
- ✅ **App review** may be required for some permissions

## 🔧 LIVE MODE CONFIGURATION STEPS

### Step 1: Facebook App Settings for Live Mode

1. **Go to Facebook Developer Console:**
   ```
   https://developers.facebook.com/apps/2251494668686316/settings/basic/
   ```

2. **Add Website Platform (CRITICAL):**
   - Click "Add Platform"
   - Select **"Website"**
   - **Site URL:** `https://mui-unpretentious-coextensively.ngrok-free.dev`
   - Save changes

3. **Configure App Domains:**
   - Add only: `mui-unpretentious-coextensively.ngrok-free.dev`
   - **NOTE:** Remove `localhost` for Live mode - it won't work

### Step 2: Facebook Login Settings (Live Mode)

1. **Navigate to Login Settings:**
   ```
   https://developers.facebook.com/apps/2251494668686316/facebook-login/settings/
   ```

2. **Configure OAuth Settings:**
   - ✅ **Client OAuth Login:** Yes
   - ✅ **Web OAuth Login:** Yes
   - ✅ **Enforce HTTPS:** Yes (locked in Live mode)
   - ✅ **Use Strict Mode for Redirect URIs:** Yes (locked in Live mode)

3. **Add Valid OAuth Redirect URIs (HTTPS ONLY):**
   ```
   https://mui-unpretentious-coextensively.ngrok-free.dev/api/oauth/social/facebook/callback
   ```

   **IMPORTANT:** Do NOT add localhost URLs in Live mode - they will be rejected

### Step 3: Handle Local Development

For local development with Live mode, you have 2 options:

#### Option A: Use Ngrok Only (Recommended)
- **Development URL:** Always use `https://mui-unpretentious-coextensively.ngrok-free.dev`
- **Local testing:** Access via ngrok URL, not localhost
- **Pros:** Works immediately with Live mode
- **Cons:** Slightly slower due to tunneling

#### Option B: Create Test App
1. **Create a Test App:**
   - Go to your app dashboard
   - Click "Create Test App" 
   - Test apps can use localhost and have relaxed requirements

2. **Configure Test App for Localhost:**
   - Use test app credentials in development
   - Switch to main app credentials for production

### Step 4: Business Verification (If Required)

If Facebook requires business verification:

1. **Go to Business Settings:**
   ```
   https://business.facebook.com/settings/info
   ```

2. **Complete Verification:**
   - Add business details
   - Upload required documents
   - Verify business phone/email

3. **Wait for Approval:** (usually 1-3 business days)

### Step 5: App Review (If Required)

For the permissions we're using (`pages_manage_posts`, etc.), you may need app review:

1. **Go to App Review:**
   ```
   https://developers.facebook.com/apps/2251494668686316/app-review/
   ```

2. **Request Permissions:**
   - Add `pages_manage_posts`
   - Add `pages_read_engagement`
   - Add `instagram_basic`
   - Add `instagram_content_publish`

3. **Complete Review Process:**
   - Provide app description
   - Upload screencast of functionality
   - Wait for Facebook review (3-7 business days)

## 🧪 TESTING LIVE MODE CONFIGURATION

### Test with Ngrok URL:
1. **Access your app:**
   ```
   https://mui-unpretentious-coextensively.ngrok-free.dev/dashboard/social-accounts
   ```

2. **Test Facebook Connection:**
   - Click "Connect Account" for Facebook
   - You should be redirected to Facebook
   - Login with a Facebook account
   - Grant permissions
   - Should redirect back successfully

### Verification Commands:
```bash
# Test OAuth endpoint
curl -I "https://mui-unpretentious-coextensively.ngrok-free.dev/api/oauth/social/facebook"

# Test with debug endpoint
curl "https://mui-unpretentious-coextensively.ngrok-free.dev/api/auth/social/facebook/debug?action=config"
```

## 🚨 TROUBLESHOOTING LIVE MODE ISSUES

### "URL Blocked" Still Appears:
1. **Double-check redirect URI:**
   - Must be exactly: `https://mui-unpretentious-coextensively.ngrok-free.dev/api/oauth/social/facebook/callback`
   - No trailing slashes, no extra parameters

2. **Verify app domains:**
   - Must be exactly: `mui-unpretentious-coextensively.ngrok-free.dev`
   - No `https://` prefix, no paths

3. **Check app status:**
   - Ensure app is actually in Live mode
   - Ensure you're logged in as app admin

### Localhost Testing Issues:
- **Never use localhost URLs in Live mode app settings**
- **Always test through ngrok URL for Live mode**
- **Create a Test App for localhost development**

### Business Verification Required:
- Complete business verification first
- Use test app for development while waiting

### App Review Required:
- Submit for app review if prompted
- Use test app for development while waiting

## ✅ LIVE MODE CHECKLIST

- [ ] Website platform added with HTTPS Site URL
- [ ] App domains set to ngrok domain only (no localhost)
- [ ] OAuth redirect URIs use HTTPS only
- [ ] Enforce HTTPS is enabled (Live mode requirement)
- [ ] Strict Mode is enabled (Live mode requirement)
- [ ] Testing through ngrok URL, not localhost
- [ ] Business verification completed (if required)
- [ ] App review submitted (if required)

## 🎯 NEXT STEPS

1. **Complete the configuration above**
2. **Test through ngrok URL only**
3. **If you need localhost development, create a Test App**
4. **Let me know the results!**

The key difference: **Live mode requires HTTPS everywhere and doesn't allow localhost in app settings.**