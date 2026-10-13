-- Snapshot destinations once, so a retry never resends accepted tickets.
ALTER TABLE notification_outbox ADD COLUMN initialized_at TEXT;
ALTER TABLE notification_outbox ADD COLUMN lease_until TEXT;
CREATE TABLE push_deliveries (
 outbox_id TEXT NOT NULL REFERENCES notification_outbox(id) ON DELETE CASCADE,
 token TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'pending',
 ticket_id TEXT,
 error_code TEXT,
 PRIMARY KEY(outbox_id, token)
);
ALTER TABLE push_receipts ADD COLUMN outbox_id TEXT;
CREATE INDEX push_receipts_created ON push_receipts(created_at);

CREATE TABLE maintenance_cursors (name TEXT PRIMARY KEY, cursor TEXT NOT NULL);
