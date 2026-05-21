-- Create a default workspace for legacy rows
INSERT INTO workspaces (id, name)
SELECT '00000000-0000-0000-0000-000000000001', 'Default Workspace'
WHERE NOT EXISTS (
  SELECT 1 FROM workspaces WHERE id = '00000000-0000-0000-0000-000000000001'
);

ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS trade_name varchar(255);
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS legal_name varchar(255);
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS document varchar(20);
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS phone varchar(30);
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS billing_email varchar(255);
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'trial';
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS current_plan_code varchar(50);
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS due_date timestamp;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS domain varchar(255);
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS subdomain varchar(100);
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS owner_user_id uuid;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS trial_ends_at timestamp;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS suspended_at timestamp;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS cancelled_at timestamp;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now();
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();

ALTER TABLE messages ADD COLUMN IF NOT EXISTS workspace_id uuid;
UPDATE messages m
SET workspace_id = c.workspace_id
FROM conversations c
WHERE m.conversation_id = c.id
  AND m.workspace_id IS NULL;
UPDATE messages SET workspace_id = '00000000-0000-0000-0000-000000000001' WHERE workspace_id IS NULL;
ALTER TABLE messages ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_workspace_id ON messages (workspace_id);

ALTER TABLE templates ADD COLUMN IF NOT EXISTS workspace_id uuid;
UPDATE templates t
SET workspace_id = c.workspace_id
FROM channels c
WHERE t.channel_id = c.id
  AND t.workspace_id IS NULL;
UPDATE templates SET workspace_id = '00000000-0000-0000-0000-000000000001' WHERE workspace_id IS NULL;
ALTER TABLE templates ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_templates_workspace_id ON templates (workspace_id);

ALTER TABLE processed_messages ADD COLUMN IF NOT EXISTS workspace_id uuid;
UPDATE processed_messages SET workspace_id = '00000000-0000-0000-0000-000000000001' WHERE workspace_id IS NULL;
ALTER TABLE processed_messages ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_processed_messages_workspace_id ON processed_messages (workspace_id);
