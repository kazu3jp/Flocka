-- No FK: retries must survive partial cleanup and user/session removal.
CREATE TABLE account_deletions (
  account_id TEXT PRIMARY KEY,
  requested_at TEXT NOT NULL,
  retry_after TEXT NOT NULL,
  lease_until TEXT,
  attempts INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX account_deletions_due ON account_deletions(retry_after);
-- Keep revocation completion distinct from a provider that never supplied tokens.
ALTER TABLE auth_accounts ADD COLUMN revocation_completed_at TEXT;
