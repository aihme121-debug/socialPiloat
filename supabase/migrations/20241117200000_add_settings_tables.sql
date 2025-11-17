-- Add notification and privacy settings tables
CREATE TABLE "notification_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email_notifications" BOOLEAN NOT NULL DEFAULT true,
    "push_notifications" BOOLEAN NOT NULL DEFAULT true,
    "marketing_emails" BOOLEAN NOT NULL DEFAULT false,
    "security_alerts" BOOLEAN NOT NULL DEFAULT true,
    "content_reminders" BOOLEAN NOT NULL DEFAULT true,
    "analytics_reports" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT NOT NULL
);

CREATE TABLE "privacy_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profile_visibility" BOOLEAN NOT NULL DEFAULT true,
    "show_email" BOOLEAN NOT NULL DEFAULT false,
    "show_activity" BOOLEAN NOT NULL DEFAULT true,
    "data_sharing" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT NOT NULL
);

-- Create unique indexes
CREATE UNIQUE INDEX "notification_settings_user_id_key" ON "notification_settings"("user_id");
CREATE UNIQUE INDEX "privacy_settings_user_id_key" ON "privacy_settings"("user_id");

-- Create foreign key constraints
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "privacy_settings" ADD CONSTRAINT "privacy_settings_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create regular indexes for performance
CREATE INDEX "notification_settings_user_id_idx" ON "notification_settings"("user_id");
CREATE INDEX "privacy_settings_user_id_idx" ON "privacy_settings"("user_id");