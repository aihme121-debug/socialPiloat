-- Multi-tenant Facebook Integration Schema
-- Adds secure Facebook account and page management with encrypted tokens

-- Create Facebook accounts table for per-user Facebook account management
CREATE TABLE facebook_accounts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    
    -- Facebook user information
    fb_user_id TEXT NOT NULL,
    fb_user_name TEXT NOT NULL,
    fb_user_email TEXT,
    fb_user_picture_url TEXT,
    
    -- Account status and metadata
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMP(3),
    created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, fb_user_id),
    INDEX(tenant_id),
    INDEX(business_id),
    INDEX(fb_user_id),
    INDEX(is_active)
);

-- Create Facebook pages table for per-page management with encrypted tokens
CREATE TABLE facebook_pages (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    facebook_account_id TEXT NOT NULL REFERENCES facebook_accounts(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    
    -- Page information
    page_id TEXT NOT NULL,
    page_name TEXT NOT NULL,
    page_category TEXT,
    page_picture_url TEXT,
    page_access_token_encrypted TEXT NOT NULL, -- Encrypted token
    
    -- Token metadata
    token_expires_at TIMESTAMP(3),
    token_scopes TEXT[], -- Array of granted scopes
    
    -- Webhook subscription status
    webhook_subscribed BOOLEAN DEFAULT false,
    webhook_subscribed_at TIMESTAMP(3),
    webhook_subscription_id TEXT,
    
    -- Connection status
    connection_status TEXT DEFAULT 'connected' CHECK (connection_status IN ('connected', 'disconnected', 'error', 'needs_reauth')),
    last_error_message TEXT,
    last_successful_connection TIMESTAMP(3),
    
    -- Rate limiting
    rate_limit_remaining INTEGER DEFAULT 200,
    rate_limit_reset_at TIMESTAMP(3),
    
    -- Timestamps
    connected_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP(3),
    created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(facebook_account_id, page_id),
    INDEX(user_id),
    INDEX(tenant_id),
    INDEX(business_id),
    INDEX(page_id),
    INDEX(connection_status),
    INDEX(webhook_subscribed),
    INDEX(token_expires_at)
);

-- Create Facebook page insights table for analytics
CREATE TABLE facebook_page_insights (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    facebook_page_id TEXT NOT NULL REFERENCES facebook_pages(id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Insight metrics
    metric_name TEXT NOT NULL,
    metric_value DECIMAL(15,2),
    metric_period TEXT DEFAULT 'day', -- day, week, days_28
    
    -- Date range
    date_start DATE NOT NULL,
    date_end DATE NOT NULL,
    
    created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    
    INDEX(facebook_page_id),
    INDEX(tenant_id),
    INDEX(metric_name),
    INDEX(date_start),
    UNIQUE(facebook_page_id, metric_name, date_start, metric_period)
);

-- Create Facebook webhook events table for audit trail
CREATE TABLE facebook_webhook_events (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    facebook_page_id TEXT REFERENCES facebook_pages(id) ON DELETE SET NULL,
    
    -- Webhook event data
    event_type TEXT NOT NULL, -- message, comment, post, reaction, etc.
    event_object TEXT NOT NULL, -- page, user, post, comment, etc.
    event_object_id TEXT NOT NULL,
    
    -- Raw webhook payload (excluding sensitive data)
    payload_json JSONB NOT NULL,
    
    -- Processing status
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP(3),
    error_message TEXT,
    
    -- Security
    signature_verified BOOLEAN DEFAULT false,
    signature_version TEXT,
    
    -- Timestamps
    received_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    
    INDEX(tenant_id),
    INDEX(facebook_page_id),
    INDEX(event_type),
    INDEX(event_object_id),
    INDEX(processed),
    INDEX(received_at)
);

-- Create Facebook actions log table for audit trail
CREATE TABLE facebook_actions_log (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    facebook_page_id TEXT NOT NULL REFERENCES facebook_pages(id) ON DELETE CASCADE,
    
    -- Action details
    action_type TEXT NOT NULL, -- send_message, reply_comment, create_post, etc.
    action_target_id TEXT, -- ID of the target (message_id, comment_id, etc.)
    action_target_type TEXT, -- message, comment, post, etc.
    
    -- Request details (excluding sensitive data)
    request_method TEXT,
    request_endpoint TEXT,
    request_payload_size INTEGER,
    
    -- Response details
    response_status INTEGER,
    response_error_message TEXT,
    response_time_ms INTEGER,
    
    -- Rate limiting
    rate_limit_remaining INTEGER,
    rate_limit_reset_at TIMESTAMP(3),
    
    -- Timestamps
    created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    
    INDEX(tenant_id),
    INDEX(user_id),
    INDEX(facebook_page_id),
    INDEX(action_type),
    INDEX(created_at),
    INDEX(action_target_id)
);

-- Create token refresh queue table for background job management
CREATE TABLE facebook_token_refresh_queue (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    facebook_page_id TEXT NOT NULL REFERENCES facebook_pages(id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Refresh status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    priority INTEGER DEFAULT 1,
    
    -- Retry logic
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    last_error_message TEXT,
    
    -- Scheduling
    scheduled_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP(3),
    
    -- Timestamps
    created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    
    INDEX(tenant_id),
    INDEX(status),
    INDEX(scheduled_at),
    INDEX(facebook_page_id),
    INDEX(status, scheduled_at)
);

-- Create composite indexes for common queries
CREATE INDEX idx_facebook_pages_user_status ON facebook_pages(user_id, connection_status);
CREATE INDEX idx_facebook_pages_tenant_webhook ON facebook_pages(tenant_id, webhook_subscribed);
CREATE INDEX idx_facebook_pages_expiring_tokens ON facebook_pages(token_expires_at) WHERE token_expires_at IS NOT NULL;
CREATE INDEX idx_facebook_webhook_events_recent ON facebook_webhook_events(received_at DESC) WHERE processed = false;
CREATE INDEX idx_facebook_actions_log_recent ON facebook_actions_log(created_at DESC);
CREATE INDEX idx_facebook_token_refresh_pending ON facebook_token_refresh_queue(status, scheduled_at) WHERE status = 'pending';