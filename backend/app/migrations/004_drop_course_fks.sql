-- Migration 004: drop the course foreign keys added in 003.
-- They broke dashboard CRUD: creating a schedule or assignment for a course code
-- that is not already in `courses` returned 409. `courses` stays a derived
-- catalogue, and `schedules.course` / `assignments.course` remain free text.

ALTER TABLE schedules DROP CONSTRAINT IF EXISTS fk_schedules_course;
ALTER TABLE assignments DROP CONSTRAINT IF EXISTS fk_assignments_course;
