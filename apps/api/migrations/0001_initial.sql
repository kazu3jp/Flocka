PRAGMA foreign_keys = ON;

CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  profile_json TEXT NOT NULL CHECK(json_valid(profile_json)),
  self_json TEXT NOT NULL CHECK(json_valid(self_json)),
  settings_json TEXT NOT NULL DEFAULT '{"allowVibe":true,"allowProof":true,"onlyConnected":true}',
  avatar_key TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE INDEX sessions_account ON sessions(account_id);

CREATE TABLE invites (
  code_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  expires_at TEXT NOT NULL,
  used_by TEXT REFERENCES accounts(id),
  used_at TEXT
);
CREATE TABLE exchanges (
  id TEXT PRIMARY KEY,
  player_a TEXT NOT NULL REFERENCES accounts(id),
  player_b TEXT NOT NULL REFERENCES accounts(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','cancelled')),
  created_at TEXT NOT NULL,
  CHECK(player_a < player_b)
);
CREATE UNIQUE INDEX one_active_exchange ON exchanges(player_a,player_b) WHERE status != 'cancelled';
CREATE INDEX exchanges_player_b ON exchanges(player_b,created_at);
CREATE INDEX exchanges_player_a ON exchanges(player_a,created_at);
CREATE TABLE exchange_participants (
  exchange_id TEXT NOT NULL REFERENCES exchanges(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  approved_at TEXT,
  place TEXT NOT NULL DEFAULT '',
  trigger TEXT NOT NULL DEFAULT '',
  PRIMARY KEY(exchange_id,account_id)
);

CREATE TABLE testimonies (
  id TEXT PRIMARY KEY,
  exchange_id TEXT NOT NULL REFERENCES exchanges(id),
  sender_id TEXT NOT NULL REFERENCES accounts(id),
  recipient_id TEXT NOT NULL REFERENCES accounts(id),
  kind TEXT NOT NULL CHECK(kind IN ('vibe','proof')),
  card TEXT NOT NULL,
  label TEXT, text TEXT, story TEXT,
  opened INTEGER NOT NULL DEFAULT 0 CHECK(opened IN (0,1)),
  guess TEXT,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','public','hidden')),
  created_at TEXT NOT NULL,
  CHECK(sender_id != recipient_id)
);
CREATE UNIQUE INDEX one_impression_per_person ON testimonies(sender_id,recipient_id) WHERE kind = 'vibe';
CREATE INDEX testimonies_inbox ON testimonies(recipient_id,created_at);
CREATE TABLE blocks (
  account_id TEXT NOT NULL REFERENCES accounts(id),
  blocked_id TEXT NOT NULL REFERENCES accounts(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY(account_id,blocked_id),
  CHECK(account_id != blocked_id)
);
CREATE TABLE moderation_requests (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  testimony_id TEXT NOT NULL REFERENCES testimonies(id),
  kind TEXT NOT NULL CHECK(kind IN ('report','deletion')),
  reason TEXT,
  created_at TEXT NOT NULL,
  withdrawn_at TEXT
);

-- Backups are private client snapshots. They never create authoritative testimonies.
CREATE TABLE backups (
  account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
  revision INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
