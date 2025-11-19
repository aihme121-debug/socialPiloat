# Facebook Integration Data Storage Guide

This document explains exactly what data is stored when a user connects their Facebook account and how real-time messages are handled.

## 📊 What Gets Stored When User Connects Facebook Account

### 1. **Social Account Data** (Table: `social_accounts`)
When a user connects their Facebook account, the following data is stored:

```json
{
  "id": "uuid-string",
  "platform": "FACEBOOK",
  "accountId": "123456789012345", // Facebook User/Page ID
  "accountName": "John Doe Business Page",
  "accessToken": "encrypted_access_token_string",
  "refreshToken": "encrypted_refresh_token_string", // if available
  "expiresAt": "2025-12-31T23:59:59.000Z", // Token expiration
  "settings": {
    "profile": {
      "id": "123456789012345",
      "name": "John Doe Business Page",
      "email": "john@business.com",
      "picture": {
        "data": {
          "url": "https://platform-lookaside.fbsbx.com/platform/profilepic/..."
        }
      }
    },
    "pages": [
      {
        "id": "098765432109876",
        "name": "Main Business Page",
        "category": "Local Business",
        "category_list": [{"id": "2500", "name": "Local Business"}],
        "access_token": "page_specific_access_token",
        "tasks": ["ANALYZE", "ADVERTISE", "MODERATE", "CREATE_CONTENT", "MANAGE"]
      }
    ]
  },
  "isActive": true,
  "connectedAt": "2025-11-19T10:30:00.000Z",
  "businessId": "user_business_uuid"
}
```

### 2. **Real-Time Message Storage** (Table: `chat_messages`)
When someone sends a message to your Facebook page, it's automatically stored:

```json
{
  "id": "uuid-string",
  "platform": "FACEBOOK",
  "accountId": "social_account_uuid",
  "messageId": "m_mid.$cAAD5cAAD5cAAD5...", // Facebook message ID
  "senderId": "sender_facebook_id",
  "senderName": "Customer Name",
  "content": "Hello, I have a question about your product",
  "mediaUrls": ["https://url-to-image-or-video-if-attached"],
  "timestamp": "2025-11-19T14:25:30.000Z",
  "status": "RECEIVED",
  "isRead": false,
  "isReplied": false,
  "businessId": "user_business_uuid"
}
```

### 3. **Conversation Tracking** (Table: `conversations`)
Messages are grouped into conversations:

```json
{
  "id": "uuid-string",
  "platform": "FACEBOOK",
  "accountId": "facebook_page_id",
  "participantIds": ["sender_facebook_id", "page_facebook_id"],
  "participantNames": ["Customer Name", "Business Page Name"],
  "lastMessageAt": "2025-11-19T14:25:30.000Z",
  "unreadCount": 1,
  "isActive": true,
  "businessId": "user_business_uuid"
}
```

## 🔒 Security & Encryption

### Access Token Security
- **Encryption**: All access tokens are encrypted before storage
- **Business Isolation**: Each business can only see their own Facebook accounts
- **Token Refresh**: Automatic token refresh before expiration
- **Scope Limited**: Only requests necessary permissions

### Data Privacy
- **Multi-tenant**: Complete business isolation
- **No Cross-access**: Users cannot access other businesses' data
- **Audit Trail**: All API calls are logged
- **Webhook Validation**: All webhooks are verified with Facebook

## 🔄 Real-Time Message Flow

### 1. **Message Reception**
```
Customer → Facebook → Webhook → Your Server → Database
```

### 2. **Message Processing**
```
Webhook Received → Validate → Find Account → Store Message → Update Conversation → Notify Dashboard
```

### 3. **Dashboard Updates**
```
New Message → Socket.IO → Real-time Update → User Sees Message
```

## 📱 What Data is Available in Dashboard

### Social Accounts Page
- ✅ Page names and IDs
- ✅ Connection status
- ✅ Follower counts (if available)
- ✅ Categories and permissions
- ✅ Connection timestamps
- ✅ Token expiration dates

### Chat Dashboard
- ✅ Real-time incoming messages
- ✅ Message history
- ✅ Customer names and IDs
- ✅ Message timestamps
- ✅ Attachment URLs
- ✅ Read/unread status
- ✅ Reply status

## 🎯 Key Features Enabled

### Automatic Features
- **Message Storage**: All incoming messages automatically saved
- **Conversation Tracking**: Messages grouped by conversation
- **Real-time Updates**: New messages appear instantly in dashboard
- **Unread Counts**: Automatic unread message counting
- **Read Receipts**: Track when messages are read
- **Attachment Handling**: Store images, videos, files

### Manual Features
- **Send Messages**: Reply to customers from dashboard
- **Mark as Read**: Manually mark messages as read
- **Conversation Management**: Archive, prioritize conversations

## 📊 Database Relationships

```
Business → SocialAccount → ChatMessage
   ↓           ↓              ↓
User      Facebook Page   Individual Messages
           Access Token   Conversations
```

## ✅ Summary

**YES** - When a user connects their Facebook account:

1. **Page Information**: Page name, ID, category, followers stored
2. **Access Tokens**: Encrypted access tokens for API calls stored
3. **Real-time Messages**: All incoming messages automatically saved
4. **Conversations**: Message threads organized and tracked
5. **Attachments**: Images, videos, files stored with URLs
6. **Customer Data**: Sender names and IDs stored for conversations
7. **Business Context**: Everything tied to the correct business

The system is **fully automated** - once connected, all Facebook interactions are captured and stored in real-time! 🚀