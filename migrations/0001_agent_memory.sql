-- TA2LK AI persistent memory foundation.
-- Apply with: npx wrangler d1 migrations apply <DATABASE_NAME>
-- Identity is intentionally abstract: API authentication must be added before
-- exposing these tables to production users.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'محادثة جديدة',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  archived_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_conversations_owner_updated
  ON conversations(owner_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  metadata_json TEXT,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON messages(conversation_id, created_at ASC);

CREATE TABLE IF NOT EXISTS memory_facts (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  fact TEXT NOT NULL,
  source_conversation_id TEXT,
  confidence REAL NOT NULL DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (source_conversation_id) REFERENCES conversations(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_memory_facts_owner_category
  ON memory_facts(owner_id, category, updated_at DESC);

CREATE TABLE IF NOT EXISTS skill_sources (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  skill_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('github', 'documentation', 'web')),
  source_revision TEXT,
  review_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'approved', 'rejected', 'installed')),
  review_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  reviewed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_skill_sources_owner_status
  ON skill_sources(owner_id, review_status, created_at DESC);

CREATE TABLE IF NOT EXISTS agent_change_log (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  change_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  git_branch TEXT,
  git_commit TEXT,
  test_status TEXT NOT NULL DEFAULT 'not_run'
    CHECK (test_status IN ('not_run', 'passed', 'failed')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_agent_change_log_owner_created
  ON agent_change_log(owner_id, created_at DESC);
