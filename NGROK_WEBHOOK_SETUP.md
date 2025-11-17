# Ngrok Webhook Setup Guide for SocialPilot

## 🚀 Quick Setup

Your ngrok tunnel is now running and configured! Here's what you need to know:

### ✅ Current Configuration
- **Ngrok URL**: `https://mui-unpretentious-coextensively.ngrok-free.dev`
- **Local Server**: Port 3001
- **Status**: Active and ready for webhooks

### 🔗 Webhook Endpoints Ready

Your social media webhook endpoints are now configured and ready:

1. **Facebook Webhook**: `https://mui-unpretentious-coextensively.ngrok-free.dev/api/facebook/webhook`
2. **Instagram Webhook**: `https://mui-unpretentious-coextensively.ngrok-free.dev/api/instagram/webhook`
3. **Twitter Webhook**: `https://mui-unpretentious-coextensively.ngrok-free.dev/api/twitter/webhook`
4. **LinkedIn Webhook**: `https://mui-unpretentious-coextensively.ngrok-free.dev/api/linkedin/webhook`

### 🔐 OAuth Callback URLs

Your OAuth redirect URLs are configured for all platforms:

- **Facebook**: `https://mui-unpretentious-coextensively.ngrok-free.dev/api/auth/social/facebook/callback`
- **Instagram**: `https://mui-unpretentious-coextensively.ngrok-free.dev/api/auth/social/instagram/callback`
- **Twitter**: `https://mui-unpretentious-coextensively.ngrok-free.dev/api/auth/social/twitter/callback`
- **LinkedIn**: `https://mui-unpretentious-coextensively.ngrok-free.dev/api/auth/social/linkedin/callback`

## 📋 Platform-Specific Setup Instructions

### Facebook Setup
1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Select your app
3. Navigate to **Webhooks** → **Instagram** → **Page**
4. Click **Subscribe to this topic**
5. Enter your webhook URL: `https://mui-unpretentious-coextensively.ngrok-free.dev/api/facebook/webhook`
6. Enter verify token: `messages`
7. Select fields to subscribe: `messages`, `messaging_postbacks`, `messaging_deliveries`, `messaging_reads`, `feed`

### Instagram Setup
1. In Facebook Developers, go to **Webhooks** → **Instagram** → **Instagram Business Account**
2. Subscribe to topics: `messages`, `messaging_postbacks`, `mentions`, `comments`, `story_insights`
3. Use webhook URL: `https://mui-unpretentious-coextensively.ngrok-free.dev/api/instagram/webhook`

### Twitter Setup
1. Go to [Twitter Developer Portal](https://developer.twitter.com/)
2. Create a webhook configuration
3. Use URL: `https://mui-unpretentious-coextensively.ngrok-free.dev/api/twitter/webhook`
4. Register webhook and subscribe to events

### LinkedIn Setup
1. Go to [LinkedIn Developers](https://www.linkedin.com/developers/)
2. Configure webhook endpoints
3. Use URL: `https://mui-unpretentious-coextensively.ngrok-free.dev/api/linkedin/webhook`

## 🔄 Managing Ngrok

### Restart Ngrok
If you need to restart ngrok:
```bash
# Stop current ngrok process
taskkill /F /IM ngrok.exe

# Start new tunnel
ngrok http 3001
```

### Update Webhook URLs
When ngrok restarts with a new URL, run:
```bash
# Update all environment variables
powershell -ExecutionPolicy Bypass -File scripts/setup-ngrok.ps1
```

### Monitor Webhooks
Check ngrok dashboard at: `http://localhost:4040`

## 🛠️ Troubleshooting

### Common Issues

1. **Webhook Verification Failed**
   - Check verify token matches `FACEBOOK_VERIFY_TOKEN=messages`
   - Ensure webhook URL is accessible
   - Check ngrok is running

2. **Signature Verification Failed**
   - Verify `FACEBOOK_APP_SECRET` is correct
   - Check request body is not modified
   - Ensure proper HMAC-SHA256 calculation

3. **Ngrok Tunnel Not Working**
   - Check ngrok auth token: `ngrok config add-authtoken YOUR_TOKEN`
   - Verify local server is running on port 3001
   - Check firewall settings

4. **OAuth Callback Errors**
   - Verify redirect URLs in social media app settings
   - Check `NEXTAUTH_URL_PRODUCTION` is set correctly
   - Ensure all OAuth credentials are valid

### Debug Commands
```bash
# Check ngrok status
curl http://localhost:4040/api/tunnels

# Test webhook manually
curl -X POST https://your-ngrok-url/api/facebook/webhook \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=YOUR_SIGNATURE" \
  -d '{"object":"page","entry":[]}'
```

## 📊 Webhook Events Handled

Your system can handle these webhook events:

### Facebook
- ✅ Messages (text, attachments)
- ✅ Message delivery confirmations
- ✅ Message read receipts
- ✅ Postback events
- ✅ Page feed updates (comments, reactions, posts)
- ✅ Page mentions
- ✅ Conversation updates

### Instagram
- ✅ Media updates
- ✅ Comments
- ✅ Mentions
- ✅ Story insights
- ✅ Account insights
- ✅ Direct messages

## 📝 Next Steps

1. **Configure Social Media Apps**: Update your app settings with the webhook URLs
2. **Test Webhooks**: Use the social media platform's webhook testing tools
3. **Monitor Logs**: Check your application logs for webhook events
4. **Implement Business Logic**: Add your custom logic to handle webhook events

## 🔗 Useful Links

- [Ngrok Documentation](https://ngrok.com/docs)
- [Facebook Webhooks Guide](https://developers.facebook.com/docs/graph-api/webhooks)
- [Instagram Webhooks](https://developers.facebook.com/docs/instagram-basic-display-api/webhooks)
- [Twitter Webhooks](https://developer.twitter.com/en/docs/twitter-api/enterprise/account-activity-api/guides/getting-started)
- [LinkedIn Webhooks](https://docs.microsoft.com/en-us/linkedin/shared/integrations/people/notification-webhooks)

---

**Your ngrok tunnel is ready! 🎉**
Start connecting your social media accounts and testing webhooks.