-- Workers AI usage for self-PR drafts. A day is the UTC date, which is when
-- Cloudflare's free Neuron allocation resets (00:00 UTC = 09:00 JST).
CREATE TABLE ai_usage_days (
  day TEXT PRIMARY KEY,
  -- Estimated Neurons reserved or used across all accounts.
  neurons REAL NOT NULL DEFAULT 0 CHECK (neurons >= 0),
  calls INTEGER NOT NULL DEFAULT 0 CHECK (calls >= 0)
);
CREATE TABLE ai_usage_accounts (
  day TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  calls INTEGER NOT NULL DEFAULT 0 CHECK (calls >= 0),
  PRIMARY KEY (day, account_id)
) WITHOUT ROWID;
CREATE INDEX ai_usage_accounts_account ON ai_usage_accounts(account_id);
