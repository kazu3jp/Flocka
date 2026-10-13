CREATE TABLE player_preferences (
 account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
 data_json TEXT NOT NULL DEFAULT '{"showcase":[],"resp":{},"deco":{},"prDraft":null}',
 revision INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL
);
ALTER TABLE moderation_requests ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE moderation_requests ADD COLUMN resolution TEXT;
ALTER TABLE moderation_requests ADD COLUMN resolved_at TEXT;
ALTER TABLE moderation_requests ADD COLUMN resolved_by TEXT;
ALTER TABLE testimonies ADD COLUMN removed_at TEXT;
CREATE TABLE api_request_limits (key TEXT PRIMARY KEY, window INTEGER NOT NULL, count INTEGER NOT NULL);
CREATE TABLE push_devices (
 token TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 platform TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX push_devices_account ON push_devices(account_id);
CREATE TABLE notification_outbox (
 id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 kind TEXT NOT NULL, resource_id TEXT NOT NULL, created_at TEXT NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at TEXT NOT NULL, delivered_at TEXT
);
CREATE TABLE push_receipts (
 ticket_id TEXT PRIMARY KEY, token TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE moderation_audit (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL, admin_id TEXT NOT NULL, action TEXT NOT NULL,
 note TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX notification_outbox_due ON notification_outbox(next_attempt_at) WHERE delivered_at IS NULL;
