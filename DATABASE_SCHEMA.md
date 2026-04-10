# Tracksy — Database Schema

MongoDB database with 9 collections.

---

## Entity Relationship Overview

```
User ────────────────────────────────────────────────────────────┐
 │                                                               │
 ├──< Project (owner)          Project ──< ProjectMember >── User
 │       │                                                       │
 │       └──< Task (reporter, assignees[])                       │
 │               │                                               │
 │               └──< Comment (author, mentions[])               │
 │               └──[ TimeEntry (user) ]  (embedded)             │
 │               └──[ Attachment ]        (embedded)             │
 │                                                               │
 ├──< Attendance (user)                                          │
 │       └──[ AttendanceNote ]  (embedded)                       │
 │                                                               │
 ├──< CalendarEvent (owner, createdBy, invitees[])               │
 ├──< Note (owner)                                               │
 ├──< Resource (assignedTo, assignedBy)                          │
 └──< Notification (recipient, sender)                           │
```

---

## Collections

### 1. `users`

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `_id` | ObjectId | auto | — | Primary key |
| `name` | String | ✓ | — | max 100 chars |
| `email` | String | ✓ | — | unique, lowercase |
| `password` | String | ✓ | — | bcrypt hashed, select: false |
| `role` | String (enum) | — | `member` | `admin` `manager` `member` `viewer` |
| `avatar` | String | — | `""` | URL |
| `department` | String | — | `""` | |
| `isActive` | Boolean | — | `true` | |
| `lateThreshold` | String | — | `"09:30"` | HH:MM format |
| `refreshToken` | String | — | — | select: false |
| `createdAt` | Date | auto | — | |
| `updatedAt` | Date | auto | — | |

**Indexes:** `email` (unique)

---

### 2. `projects`

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `_id` | ObjectId | auto | — | |
| `title` | String | ✓ | — | max 200 chars |
| `description` | String | — | `""` | max 2000 chars |
| `status` | String (enum) | — | `planning` | `planning` `active` `on_hold` `completed` `archived` |
| `priority` | String (enum) | — | `medium` | `low` `medium` `high` `critical` |
| `startDate` | Date | ✓ | — | |
| `endDate` | Date | ✓ | — | |
| `owner` | ObjectId → User | ✓ | — | |
| `members` | Array of ProjectMember | — | `[]` | embedded |
| `tags` | String[] | — | `[]` | |
| `progress` | Number | — | `0` | 0–100, auto-calculated |
| `thumbnail` | String | — | `""` | URL |
| `createdAt` | Date | auto | — | |
| `updatedAt` | Date | auto | — | |

**Embedded — ProjectMember:**

| Field | Type | Notes |
|-------|------|-------|
| `user` | ObjectId → User | |
| `role` | String (enum) | `lead` `member` `viewer` |

**Indexes:** `owner`, `status`, `members.user`

---

### 3. `tasks`

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `_id` | ObjectId | auto | — | |
| `title` | String | ✓ | — | max 300 chars |
| `description` | String | — | `""` | max 5000 chars |
| `remark` | String | — | `""` | max 2000 chars |
| `project` | ObjectId → Project | — | — | null = personal task |
| `isPersonal` | Boolean | — | `false` | |
| `status` | String (enum) | — | `backlog` | `backlog` `todo` `in_progress` `in_review` `done` |
| `priority` | String (enum) | — | `medium` | `low` `medium` `high` `critical` |
| `assignees` | ObjectId[] → User | — | `[]` | |
| `reporter` | ObjectId → User | ✓ | — | |
| `dueDate` | Date | — | — | |
| `estimatedHours` | Number | — | — | min 0 |
| `loggedHours` | Number | — | `0` | auto-accumulated from timer |
| `tags` | String[] | — | `[]` | |
| `dependencies` | ObjectId[] → Task | — | `[]` | |
| `attachments` | Array of Attachment | — | `[]` | embedded |
| `links` | String[] | — | `[]` | URLs |
| `order` | Number | — | `0` | kanban sort order |
| `timeEntries` | Array of TimeEntry | — | `[]` | embedded |
| `timerStatus` | String (enum) | — | `idle` | `idle` `running` `paused` |
| `activeTimerStart` | Date | — | — | set when timer starts |
| `activeTimerUser` | ObjectId → User | — | — | who is running the timer |
| `thumbnail` | String | — | `""` | |
| `createdAt` | Date | auto | — | |
| `updatedAt` | Date | auto | — | |

**Embedded — Attachment:**

| Field | Type | Notes |
|-------|------|-------|
| `name` | String | filename |
| `url` | String | |
| `type` | String (enum) | `file` `image` `link` |
| `uploadedAt` | Date | |

**Embedded — TimeEntry:**

| Field | Type | Notes |
|-------|------|-------|
| `user` | ObjectId → User | |
| `startTime` | Date | |
| `endTime` | Date | optional |
| `duration` | Number | minutes |
| `action` | String (enum) | `start` `pause` `done` |

**Indexes:** `(project, status)`, `assignees`, `reporter`, `isPersonal`

---

### 4. `attendances`

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `_id` | ObjectId | auto | — | |
| `user` | ObjectId → User | ✓ | — | |
| `date` | Date | ✓ | — | midnight UTC |
| `checkIn` | Date | — | — | |
| `checkOut` | Date | — | — | |
| `lunchStart` | Date | — | — | |
| `lunchStop` | Date | — | — | |
| `lunchDuration` | Number | — | `0` | minutes |
| `status` | String (enum) | — | `present` | `present` `absent` `half_day` `remote` `leave` `late` |
| `workMode` | String (enum) | — | `office` | `office` `remote` `hybrid` |
| `notes` | Array of AttendanceNote | — | `[]` | embedded |
| `hoursWorked` | Number | — | `0` | auto-calculated |
| `isLate` | Boolean | — | `false` | compared against lateThreshold |
| `approvedBy` | ObjectId → User | — | — | admin approval |
| `createdAt` | Date | auto | — | |
| `updatedAt` | Date | auto | — | |

**Embedded — AttendanceNote:**

| Field | Type | Notes |
|-------|------|-------|
| `content` | String | max 5000 chars |
| `documents` | String[] | URLs |
| `links` | String[] | URLs |
| `createdAt` | Date | |

**Indexes:** `(user, date)` unique, `date`

---

### 5. `calendarevents`

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `_id` | ObjectId | auto | — | |
| `title` | String | ✓ | — | max 200 chars |
| `description` | String | — | — | max 2000 chars |
| `type` | String (enum) | — | `event` | `meeting` `reminder` `event` `deadline` |
| `date` | Date | ✓ | — | |
| `startTime` | String | — | — | `"HH:MM"` |
| `endTime` | String | — | — | `"HH:MM"` |
| `allDay` | Boolean | — | `false` | |
| `color` | String | — | `#6366f1` | hex color |
| `location` | String | — | — | |
| `recurrence` | String (enum) | — | `none` | `none` `daily` `weekly` `monthly` |
| `owner` | ObjectId → User | ✓ | — | event belongs to this user |
| `createdBy` | ObjectId → User | ✓ | — | who created it |
| `invitees` | ObjectId[] → User | — | `[]` | |
| `createdAt` | Date | auto | — | |
| `updatedAt` | Date | auto | — | |

---

### 6. `notes`

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `_id` | ObjectId | auto | — | |
| `title` | String | — | `"Untitled Note"` | max 200 chars |
| `content` | String | — | `""` | max 10000 chars |
| `owner` | ObjectId → User | ✓ | — | |
| `color` | String | — | `""` | hex color |
| `isPinned` | Boolean | — | `false` | |
| `createdAt` | Date | auto | — | |
| `updatedAt` | Date | auto | — | |

**Indexes:** `(owner, updatedAt desc)`

---

### 7. `comments`

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `_id` | ObjectId | auto | — | |
| `content` | String | ✓ | — | max 2000 chars |
| `author` | ObjectId → User | ✓ | — | |
| `task` | ObjectId → Task | — | — | one of task/project |
| `project` | ObjectId → Project | — | — | one of task/project |
| `mentions` | ObjectId[] → User | — | `[]` | @mentioned users |
| `createdAt` | Date | auto | — | |
| `updatedAt` | Date | auto | — | |

**Indexes:** `(task, createdAt desc)`, `(project, createdAt desc)`

---

### 8. `notifications`

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `_id` | ObjectId | auto | — | |
| `recipient` | ObjectId → User | ✓ | — | |
| `sender` | ObjectId → User | ✓ | — | |
| `type` | String (enum) | ✓ | — | `task_assigned` `comment_mention` `deadline_reminder` `status_change` `project_invite` |
| `title` | String | ✓ | — | max 200 chars |
| `message` | String | ✓ | — | max 500 chars |
| `link` | String | — | — | deep link URL |
| `isRead` | Boolean | — | `false` | |
| `createdAt` | Date | auto | — | |
| `updatedAt` | Date | auto | — | |

**Indexes:** `(recipient, isRead, createdAt desc)`

---

### 9. `resources`

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `_id` | ObjectId | auto | — | |
| `name` | String | ✓ | — | max 200 chars |
| `description` | String | — | — | max 1000 chars |
| `category` | String | ✓ | — | e.g. Laptop, Phone |
| `assignedTo` | ObjectId → User | ✓ | — | current holder |
| `assignedBy` | ObjectId → User | ✓ | — | admin who assigned |
| `serialNumber` | String | — | — | |
| `condition` | String (enum) | — | `good` | `new` `good` `fair` `damaged` |
| `assignedAt` | Date | — | now | |
| `returnedAt` | Date | — | — | null = still assigned |
| `isActive` | Boolean | — | `true` | false = returned |
| `createdAt` | Date | auto | — | |
| `updatedAt` | Date | auto | — | |

**Indexes:** `assignedTo`, `isActive`

---

## Reference Summary

| Collection | References |
|------------|-----------|
| `projects` | `users` (owner, members[].user) |
| `tasks` | `projects`, `users` (reporter, assignees[], timeEntries[].user, activeTimerUser), `tasks` (dependencies[]) |
| `attendances` | `users` (user, approvedBy) |
| `calendarevents` | `users` (owner, createdBy, invitees[]) |
| `notes` | `users` (owner) |
| `comments` | `users` (author, mentions[]), `tasks`, `projects` |
| `notifications` | `users` (recipient, sender) |
| `resources` | `users` (assignedTo, assignedBy) |

---

## Access Control

| Role | Permissions |
|------|-------------|
| `admin` | Full access to all collections and all users' data |
| `manager` | View all tasks/attendance; manage projects and team |
| `member` | Own tasks only; own attendance; own notes/calendar events |
| `viewer` | Read-only access to assigned projects and tasks |
