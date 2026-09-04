-- Migration 004: Drop roles and role_permissions tables; enforce single 'student' role with full access

-- 1. Remove foreign key constraint from users to roles
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_id_fkey;

-- 2. Drop junction and roles tables
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

-- 3. Remove non-student users (teachers, authorities)
DELETE FROM users WHERE role_id != 'student';

-- 4. Enforce that role_id is always 'student' on users table
UPDATE users SET role_id = 'student' WHERE role_id IS NULL OR role_id != 'student';
ALTER TABLE users ALTER COLUMN role_id SET DEFAULT 'student';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_id_check;
ALTER TABLE users ADD CONSTRAINT users_role_id_check CHECK (role_id = 'student');
