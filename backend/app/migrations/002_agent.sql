-- Agent runtime: conversation store, pending actions, idempotency, quota snapshot, hot-path indexes.

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversation_turns (
  id BIGSERIAL PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  tool_trace JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_turns_conv ON conversation_turns(conversation_id, id);

-- Server-side plan for an inferred write. action_id IS the credential (bound to student + conversation).
CREATE TABLE IF NOT EXISTS pending_actions (
  action_id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  tool TEXT NOT NULL,
  args JSONB NOT NULL,
  summary TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pending_expiry ON pending_actions(expires_at);

-- Deterministic per-dispatch key so a re-dispatch of the same parsed tool call executes once.
CREATE TABLE IF NOT EXISTS idempotency (
  key TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  tool TEXT NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_idem_created ON idempotency(created_at);

-- Advisory quota counters (keys are stored hashed; the provider's 429 is always the truth).
CREATE TABLE IF NOT EXISTS llm_quota_snapshot (
  key_hash TEXT NOT NULL,
  day DATE NOT NULL,
  requests INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key_hash, day)
);

CREATE INDEX IF NOT EXISTS idx_schedules_room_day ON schedules(room, day);
CREATE INDEX IF NOT EXISTS idx_events_venue_date ON events(venue, date);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date);
CREATE INDEX IF NOT EXISTS idx_registrations_student ON registrations(student_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_number_ci ON rooms(upper(room_number));
