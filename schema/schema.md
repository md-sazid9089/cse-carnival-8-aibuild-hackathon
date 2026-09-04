# CampusOS — Data Schema Reference

All seed data lives in the `data/` folder as JSON files. Below are the exact field names and types for each system.

---

## 1. Schedules (`data/schedules.json`)

| Field        | Type     | Description                                                                           |
| ------------ | -------- | ------------------------------------------------------------------------------------- |
| `id`         | `string` | Unique identifier (e.g. `"sch-001"`)                                                  |
| `course`     | `string` | Course code (e.g. `"CSE 4113"`)                                                       |
| `title`      | `string` | Full course title                                                                     |
| `day`        | `string` | Day of week: `"Sunday"` \| `"Monday"` \| `"Tuesday"` \| `"Wednesday"` \| `"Thursday"` |
| `start_time` | `string` | 24h format `"HH:MM"` (e.g. `"08:00"`)                                                 |
| `end_time`   | `string` | 24h format `"HH:MM"`                                                                  |
| `room`       | `string` | Room number (e.g. `"7A03"`)                                                           |
| `instructor` | `string` | Instructor name or `"TBA"`                                                            |
| `section`    | `string` | Section label (e.g. `"B"`, `"B1/B2"`, `"DWM"`)                                        |

---

## 2. Rooms (`data/rooms.json`)

| Field         | Type        | Description                                                            |
| ------------- | ----------- | ---------------------------------------------------------------------- |
| `id`          | `string`    | Unique identifier (e.g. `"room-001"`)                                  |
| `room_number` | `string`    | Room code (e.g. `"7A03"`, `"7B06"`)                                    |
| `type`        | `string`    | `"classroom"` \| `"lab"` \| `"seminar"`                                |
| `capacity`    | `number`    | Max number of people                                                   |
| `equipment`   | `string[]`  | List of available equipment (e.g. `["projector", "AC", "whiteboard"]`) |
| `floor`       | `number`    | Floor number                                                           |
| `status`      | `string`    | `"available"` \| `"unavailable"`                                       |
| `bookings`    | `Booking[]` | Array of booking objects (see below)                                   |

### Booking Object (inside `rooms.bookings`)

| Field        | Type     | Description                         |
| ------------ | -------- | ----------------------------------- |
| `booking_id` | `string` | Unique booking ID (e.g. `"bk-001"`) |
| `booked_by`  | `string` | Name of person/org who booked       |
| `date`       | `string` | ISO date `"YYYY-MM-DD"`             |
| `start_time` | `string` | 24h `"HH:MM"`                       |
| `end_time`   | `string` | 24h `"HH:MM"`                       |
| `purpose`    | `string` | Reason for booking                  |

---

## 3. Events (`data/events.json`)

| Field           | Type             | Description                                                               |
| --------------- | ---------------- | ------------------------------------------------------------------------- |
| `id`            | `string`         | Unique identifier (e.g. `"evt-001"`)                                      |
| `name`          | `string`         | Event name                                                                |
| `description`   | `string`         | Full event description                                                    |
| `date`          | `string`         | Start date `"YYYY-MM-DD"`                                                 |
| `start_time`    | `string`         | 24h `"HH:MM"`                                                             |
| `end_time`      | `string`         | 24h `"HH:MM"`                                                             |
| `end_date`      | `string`         | End date (same as `date` for single-day events)                           |
| `venue`         | `string`         | Room number where event is held                                           |
| `organizer`     | `string`         | Organizing person or club                                                 |
| `capacity`      | `number`         | Max registrations allowed                                                 |
| `registered`    | `number`         | Current registration count                                                |
| `registrations` | `Registration[]` | Array of registered students                                              |
| `status`        | `string`         | `"upcoming"` \| `"ongoing"` \| `"completed"` \| `"cancelled"` \| `"full"` |

### Registration Object (inside `events.registrations`)

| Field        | Type     | Description                    |
| ------------ | -------- | ------------------------------ |
| `student_id` | `string` | Student ID (e.g. `"20-40532"`) |
| `name`       | `string` | Student name                   |

---

## 4. Announcements (`data/announcements.json`)

| Field       | Type     | Description                                            |
| ----------- | -------- | ------------------------------------------------------ |
| `id`        | `string` | Unique identifier (e.g. `"ann-001"`)                   |
| `title`     | `string` | Announcement headline                                  |
| `body`      | `string` | Full announcement text                                 |
| `date`      | `string` | Date posted `"YYYY-MM-DD"`                             |
| `priority`  | `string` | `"high"` \| `"medium"` \| `"low"`                      |
| `posted_by` | `string` | Author name or department                              |
| `expires`   | `string` | Expiry date `"YYYY-MM-DD"` after which notice is stale |

---

## 5. Assignments (`data/assignments.json`)

| Field                 | Type     | Description                                                          |
| --------------------- | -------- | -------------------------------------------------------------------- |
| `id`                  | `string` | Unique identifier (e.g. `"asgn-001"`)                                |
| `course`              | `string` | Course code (e.g. `"CSE 4113"`)                                      |
| `course_title`        | `string` | Full course title                                                    |
| `title`               | `string` | Assignment title                                                     |
| `description`         | `string` | Full task description                                                |
| `assigned_date`       | `string` | Date assigned `"YYYY-MM-DD"`                                         |
| `deadline`            | `string` | Submission deadline `"YYYY-MM-DD"`                                   |
| `submission_platform` | `string` | Where to submit (e.g. `"Google Classroom"`, `"Physical submission"`) |
| `status`              | `string` | `"pending"` \| `"submitted"` \| `"graded"` \| `"late"`               |
| `marks`               | `number` | Total marks this assignment carries                                  |

---

## 6. Enrollments (`data/enrollments.json`) — added by us

The five files above describe one cohort's campus. They do not say **who takes what**, so without
this file every account would see the same 24-row timetable. Each entry registers one student for a
subset of the cohort's courses; `GET /api/schedules?mine=1` and the agent's personal tools read it,
so two students genuinely see different routines.

The object has a `note` and a `students` array:

| Field        | Type       | Description                                            |
| ------------ | ---------- | ------------------------------------------------------ |
| `student_id` | `string`   | Matches `registrations.student_id` (e.g. `"20-40532"`) |
| `name`       | `string`   | Full name — an account is created from it on boot      |
| `department` | `string`   | Department code (e.g. `"CSE"`)                         |
| `section`    | `string`   | Section label for theory classes (e.g. `"B"`)          |
| `lab_group`  | `string`   | Sub-group for lab classes (e.g. `"B1"`, `"B2"`)        |
| `elective`   | `string`   | Elective track name, `""` if none                      |
| `courses`    | `string[]` | Course codes the student is registered for             |
| `note`       | `string`   | Optional — why this student's load is unusual          |

Listed students are enrolled in exactly these courses; anyone else — including a judge who signs up —
starts on the full cohort load, so a new account is never given an empty week.

---

## Room Numbering Convention (AUST)

Rooms follow the pattern `[Floor][Wing][Number]`:

| Range         | Type          | Notes                                 |
| ------------- | ------------- | ------------------------------------- |
| `7A01`–`7A07` | Classrooms    | Regular lecture rooms, capacity 40–50 |
| `7B01`–`7B08` | Labs          | Computer labs, capacity 25–35         |
| `7C01`–`7C05` | Seminar Halls | Large rooms, capacity 55–70           |

---

## Notes for Participants

- All times use **24-hour format** (`"HH:MM"`)
- All dates use **ISO 8601** (`"YYYY-MM-DD"`)
- The university week runs **Sunday–Thursday** (Friday–Saturday are weekends)
- IDs are stable — use them as primary keys in your backend
- `equipment` is a string array — filter by checking `equipment.includes("projector")` etc.
