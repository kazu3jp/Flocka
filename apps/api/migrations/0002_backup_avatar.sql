-- Each snapshot references its immutable R2 object so a failed/stale save cannot
-- change the photo belonging to the last successful backup.
ALTER TABLE backups ADD COLUMN avatar_key TEXT;
