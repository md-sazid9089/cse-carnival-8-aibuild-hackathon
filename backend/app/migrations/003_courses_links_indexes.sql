-- Migration 003: courses + enrollments, identity linkage on existing records,
-- auth columns on users, and indexes for the filters the API/agent hit most.

-- 1. Courses -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS courses (
  code TEXT PRIMARY KEY,                       -- e.g. 'CSE 4113'
  title TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT 'CSE',
  kind TEXT NOT NULL DEFAULT 'theory' CHECK (kind IN ('theory', 'lab')),
  credits NUMERIC(3,1)
);

-- Backfill from data already loaded so the FKs below can be added safely.
INSERT INTO courses (code, title, department, kind)
SELECT DISTINCT ON (course)
       course,
       title,
       split_part(course, ' ', 1),
       CASE WHEN title ILIKE '%lab' THEN 'lab' ELSE 'theory' END
FROM schedules
ON CONFLICT (code) DO NOTHING;

INSERT INTO courses (code, title, department, kind)
SELECT DISTINCT ON (course)
       course,
       course_title,
       split_part(course, ' ', 1),
       CASE WHEN course_title ILIKE '%lab' THEN 'lab' ELSE 'theory' END
FROM assignments
ON CONFLICT (code) DO NOTHING;

-- 2. Enrollments: one table covers "student takes course" and "teacher teaches course"
CREATE TABLE IF NOT EXISTS course_enrollments (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_code TEXT NOT NULL REFERENCES courses(code) ON DELETE CASCADE,
  section TEXT NOT NULL,
  role_in_course TEXT NOT NULL CHECK (role_in_course IN ('student', 'instructor')),
  PRIMARY KEY (user_id, course_code)
);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON course_enrollments(course_code);
CREATE INDEX IF NOT EXISTS idx_enrollments_role ON course_enrollments(role_in_course);

-- 'courses' joins the permission categories from 002
ALTER TABLE permissions DROP CONSTRAINT IF EXISTS permissions_category_check;
ALTER TABLE permissions ADD CONSTRAINT permissions_category_check
  CHECK (category IN ('schedules', 'rooms', 'events', 'announcements', 'assignments', 'courses', 'system'));

-- 3. Auth columns on users (values are filled in when auth lands) ---------
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. Identity linkage on existing records --------------------------------
-- Nullable on purpose: seed rows name people who have no user account, and the
-- services still treat the free-text name/student_id as the displayed truth.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_registrations_student ON registrations(student_id);

-- 5. Course FKs on schedules/assignments ---------------------------------
-- NOTE: schedules.room is deliberately NOT a foreign key to rooms.room_number —
-- the seed data references rooms (7C07, 9A05) that do not exist in rooms.json.
DO $$ BEGIN
  ALTER TABLE schedules ADD CONSTRAINT fk_schedules_course
    FOREIGN KEY (course) REFERENCES courses(code) ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE assignments ADD CONSTRAINT fk_assignments_course
    FOREIGN KEY (course) REFERENCES courses(code) ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. Indexes for the hot filters -----------------------------------------
CREATE INDEX IF NOT EXISTS idx_schedules_day ON schedules(day, start_time);
CREATE INDEX IF NOT EXISTS idx_schedules_course ON schedules(course);
CREATE INDEX IF NOT EXISTS idx_assignments_deadline ON assignments(deadline);
CREATE INDEX IF NOT EXISTS idx_assignments_course ON assignments(course);
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON announcements(priority, date DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_expires ON announcements(expires);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date, start_time);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_rooms_type_capacity ON rooms(type, capacity);
