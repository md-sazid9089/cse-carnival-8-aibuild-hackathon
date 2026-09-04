CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- range type over TIME for booking-overlap exclusion
DO $$ BEGIN
  CREATE TYPE timerange AS RANGE (subtype = time);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  course TEXT NOT NULL,
  title TEXT NOT NULL,
  day TEXT NOT NULL CHECK (day IN ('Sunday','Monday','Tuesday','Wednesday','Thursday')),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL CHECK (end_time > start_time),
  room TEXT NOT NULL,
  instructor TEXT NOT NULL,
  section TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  room_number TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('classroom','lab','seminar')),
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  equipment TEXT[] NOT NULL DEFAULT '{}',
  floor INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('available','unavailable'))
);

CREATE TABLE IF NOT EXISTS bookings (
  booking_id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  booked_by TEXT NOT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL CHECK (end_time > start_time),
  purpose TEXT NOT NULL,
  -- overlapping booking on same room+date is rejected by the database itself
  EXCLUDE USING gist (room_id WITH =, date WITH =, timerange(start_time, end_time) WITH &&)
);
CREATE INDEX IF NOT EXISTS idx_bookings_room_date ON bookings(room_id, date);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  end_date DATE NOT NULL,
  venue TEXT NOT NULL,
  organizer TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  registered INTEGER NOT NULL DEFAULT 0 CHECK (registered >= 0 AND registered <= capacity),
  status TEXT NOT NULL CHECK (status IN ('upcoming','ongoing','completed','cancelled','full'))
);

CREATE TABLE IF NOT EXISTS registrations (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL,
  name TEXT NOT NULL,
  PRIMARY KEY (event_id, student_id)
);

CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  date DATE NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('high','medium','low')),
  posted_by TEXT NOT NULL,
  expires DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  course TEXT NOT NULL,
  course_title TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  assigned_date DATE NOT NULL,
  deadline DATE NOT NULL,
  submission_platform TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','submitted','graded','late')),
  marks INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS search_index (
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  content TEXT NOT NULL,
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  embedding vector(384),
  PRIMARY KEY (entity_type, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_search_tsv ON search_index USING GIN (tsv);
