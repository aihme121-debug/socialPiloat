-- Add message status tracking for real-time messaging
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT 'sent';
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "delivered_at" TIMESTAMP;
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "read_at" TIMESTAMP;
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "conversation_id" VARCHAR(255);
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "is_typing" BOOLEAN DEFAULT FALSE;

-- Create conversation table for better message organization
CREATE TABLE IF NOT EXISTS "conversations" (
  "id" VARCHAR(255) PRIMARY KEY,
  "platform" VARCHAR(50) NOT NULL,
  "account_id" VARCHAR(255) NOT NULL,
  "participant_ids" TEXT[] DEFAULT '{}',
  "participant_names" TEXT[] DEFAULT '{}',
  "last_message_at" TIMESTAMP,
  "unread_count" INTEGER DEFAULT 0,
  "is_active" BOOLEAN DEFAULT TRUE,
  "business_id" VARCHAR(255) NOT NULL,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "idx_chat_messages_status" ON "chat_messages"("status");
CREATE INDEX IF NOT EXISTS "idx_chat_messages_conversation_id" ON "chat_messages"("conversation_id");
CREATE INDEX IF NOT EXISTS "idx_conversations_business_id" ON "conversations"("business_id");
CREATE INDEX IF NOT EXISTS "idx_conversations_account_id" ON "conversations"("account_id");
CREATE INDEX IF NOT EXISTS "idx_conversations_last_message_at" ON "conversations"("last_message_at");

-- Update existing messages to have conversation_id based on platform and account_id
UPDATE "chat_messages" 
SET "conversation_id" = CONCAT(platform, '_', account_id, '_', sender_id)
WHERE "conversation_id" IS NULL;