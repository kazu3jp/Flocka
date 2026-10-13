CREATE TABLE legal_acceptances (
 account_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
 version TEXT NOT NULL,
 accepted_at TEXT NOT NULL,
 PRIMARY KEY(account_id, version)
);
