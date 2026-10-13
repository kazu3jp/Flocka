-- Authentication is separate from game profiles. Old anonymous tokens are revoked.
DELETE FROM sessions;
CREATE TABLE auth_users (
 id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
 email_verified INTEGER NOT NULL DEFAULT 0, image TEXT, terms_accepted INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE auth_sessions (
 id TEXT PRIMARY KEY NOT NULL, token TEXT NOT NULL UNIQUE,
 user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL, ip_address TEXT, user_agent TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX auth_sessions_user_idx ON auth_sessions(user_id);
CREATE TABLE auth_accounts (
 id TEXT PRIMARY KEY NOT NULL, account_id TEXT NOT NULL, provider_id TEXT NOT NULL,
 user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
 access_token TEXT, refresh_token TEXT, id_token TEXT, access_token_expires_at INTEGER,
 refresh_token_expires_at INTEGER, scope TEXT, password TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX auth_accounts_user_idx ON auth_accounts(user_id);
CREATE TABLE auth_verifications (
 id TEXT PRIMARY KEY NOT NULL, identifier TEXT NOT NULL, value TEXT NOT NULL,
 expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX auth_verifications_identifier_idx ON auth_verifications(identifier);
CREATE TABLE auth_rate_limits (id TEXT PRIMARY KEY NOT NULL, key TEXT NOT NULL UNIQUE, count INTEGER NOT NULL, last_request INTEGER NOT NULL);
