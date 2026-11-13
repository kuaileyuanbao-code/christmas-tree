CREATE TABLE decorations (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  message TEXT NOT NULL,
  shape TEXT NOT NULL,
  color TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 10),
  max_score INTEGER NOT NULL DEFAULT 10 CHECK (max_score IN (7, 10)),
  created_at TEXT NOT NULL,
  answers_json TEXT NOT NULL,
  quiz_version TEXT NOT NULL,
  client_hash TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  deleted_at TEXT,
  UNIQUE (client_hash, payload_hash)
);
CREATE INDEX decorations_visible ON decorations (deleted_at, created_at, id);
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX rate_limits_expiry ON rate_limits (expires_at);
