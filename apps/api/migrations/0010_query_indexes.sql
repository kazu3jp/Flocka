-- Lookups by participant: exchange views start from the viewer's participant row.
CREATE INDEX exchange_participants_account ON exchange_participants(account_id, exchange_id);
-- Sync "sent" list, and the per-pair memo limit.
CREATE INDEX testimonies_sent ON testimonies(sender_id, created_at);
-- Sync requests per account, erasure by testimony, and the admin keyset queue.
CREATE INDEX moderation_requests_account ON moderation_requests(account_id, created_at);
CREATE INDEX moderation_requests_testimony ON moderation_requests(testimony_id);
CREATE INDEX moderation_requests_queue ON moderation_requests(status, created_at, id);
-- Orphan avatar sweep: only rows that hold a photo are indexed.
CREATE INDEX accounts_avatar_key ON accounts(avatar_key) WHERE avatar_key IS NOT NULL;
CREATE INDEX backups_avatar_key ON backups(avatar_key) WHERE avatar_key IS NOT NULL;
