-- Create automation_rules table
CREATE TABLE automation_rules (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('TIME_BASED', 'EVENT_BASED', 'CONDITION_BASED')),
    trigger_config JSONB NOT NULL,
    conditions JSONB NOT NULL,
    actions JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'DRAFT')),
    priority INTEGER DEFAULT 0,
    last_executed_at TIMESTAMP(3),
    execution_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT NOT NULL,
    
    CONSTRAINT automation_rules_business_id_fkey 
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- Create automation_executions table for audit trail
CREATE TABLE automation_executions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'FAILED', 'SKIPPED')),
    triggered_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP(3),
    trigger_data JSONB,
    execution_result JSONB,
    error_message TEXT,
    execution_duration_ms INTEGER,
    
    CONSTRAINT automation_executions_rule_id_fkey 
    FOREIGN KEY (rule_id) REFERENCES automation_rules(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX idx_automation_rules_business_id ON automation_rules(business_id);
CREATE INDEX idx_automation_rules_status ON automation_rules(status);
CREATE INDEX idx_automation_rules_trigger_type ON automation_rules(trigger_type);
CREATE INDEX idx_automation_rules_priority ON automation_rules(priority DESC);
CREATE INDEX idx_automation_executions_rule_id ON automation_executions(rule_id);
CREATE INDEX idx_automation_executions_triggered_at ON automation_executions(triggered_at DESC);
CREATE INDEX idx_automation_executions_status ON automation_executions(status);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_automation_rules_updated_at 
    BEFORE UPDATE ON automation_rules 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();