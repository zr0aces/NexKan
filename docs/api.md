# NexKan API Reference

Base URL: `https://yourdomain.com/api`

All endpoints except `/webhooks/telegram` and `/notifications/check` require HTTP Basic Auth (configured in `nginx/.htpasswd`).

---

## Tasks

### List tasks

```
GET /api/tasks
```

**Query parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status. Comma-separated for multiple: `todo,in-progress` |
| `tags` | string | Filter by tags (OR logic). Comma-separated: `work,urgent` |
| `priority` | string | `low` \| `medium` \| `high` |
| `search` | string | Search in title and tags |
| `sort` | string | See sort options below |
| `overdue` | boolean | `true` → tasks where `due_date < today` and `status ≠ done` |
| `due_today` | boolean | `true` → tasks due today |
| `due_tomorrow` | boolean | `true` → tasks due tomorrow |

**Sort options**

| Value | Description |
|-------|-------------|
| (default) | `due_date:asc` — earliest due date first |
| `sort_order:asc` | Manual drag-drop order (use this for board view) |
| `due_date:desc` | Latest due date first |
| `priority:desc` | High priority first |
| `created_at:desc` | Newest first |

**Response** `200 OK` — array of Task objects

```json
[
  {
    "id": "a3f9k2mw",
    "title": "Buy groceries",
    "status": "todo",
    "priority": "high",
    "tags": ["shopping", "personal"],
    "due_date": "2026-06-01",
    "sort_order": 3,
    "created_at": "2026-05-15T10:30:00Z",
    "updated_at": "2026-05-16T08:00:00Z",
    "attachments": [],
    "description": "Buy milk, eggs, bread.",
    "notes": "Check discount aisle."
  }
]
```

---

### Get task

```
GET /api/tasks/:id
```

**Response** `200 OK` — single Task object, or `404` if not found.

---

### Create task

```
POST /api/tasks
Content-Type: application/json
```

**Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | yes | Task title |
| `status` | string | no | Default: `plan` |
| `description` | string | no | Main body text |
| `notes` | string | no | Secondary notes |
| `due_date` | string | no | `YYYY-MM-DD`. Required if status is `todo` or `in-progress` |
| `priority` | string | no | `low` \| `medium` \| `high` |
| `tags` | string[] | no | Array of tag strings |

**Response** `201 Created` — created Task object, or `400` with validation errors.

---

### Update task

```
PUT /api/tasks/:id
Content-Type: application/json
```

Only provided fields are updated. Omitted fields are left unchanged.

**Body** — same fields as Create, all optional. Pass `"due_date": null` to clear the due date.

**Response** `200 OK` — updated Task object, `400` validation error, `404` not found.

---

### Move task (change status)

```
PATCH /api/tasks/:id/status
Content-Type: application/json
```

**Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | yes | `plan` \| `todo` \| `in-progress` \| `done` |
| `due_date` | string | no | Provide if moving to `todo`/`in-progress` and task has no due date |

Moving to `todo` or `in-progress` without a `due_date` (on task or in body) returns `400`.

**Response** `200 OK` — updated Task, `400` validation/due_date error, `404` not found.

---

### Reorder task within column

```
PATCH /api/tasks/:id/order
Content-Type: application/json
```

Renumbers all tasks in the same column to insert this task at `position`.

**Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `position` | integer | yes | 0-indexed position within the column |

**Response** `200 OK` — updated Task.

---

### Delete task

```
DELETE /api/tasks/:id
```

**Response** `204 No Content`, `404` if not found.

---

## Telegram

### Webhook

```
POST /api/webhooks/telegram
```

Telegram delivers bot updates here. Validated by `X-Telegram-Bot-Api-Secret-Token` header (set in `TELEGRAM_WEBHOOK_SECRET`). No nginx basic auth on this endpoint.

---

### Trigger notification check

```
POST /api/notifications/check
X-Cron-Secret: <CRON_SECRET>
```

Reads all non-done tasks, sends Telegram alerts for overdue / due-today / due-tomorrow tasks. Deduplicated via `data/notifications-sent.json`. No nginx basic auth — protected by `X-Cron-Secret` header only.

**Response** `200 OK` → `{ "ok": true }`

---

### Bot status

```
GET /api/telegram/status
```

Pings the Telegram API to verify the bot is connected.

**Response** `200 OK` → `{ "ok": true, "bot": "YourBotUsername" }` or `503` if unreachable.

---

### Send test message

```
POST /api/telegram/test
```

Sends a test message to `TELEGRAM_CHAT_ID`. Useful to verify the bot works after setup.

**Response** `200 OK` → `{ "ok": true }`

---

## Error responses

All errors return JSON:

```json
{ "error": "Task abc12345 not found" }
```

Zod validation errors return the flattened error object:

```json
{
  "error": {
    "formErrors": [],
    "fieldErrors": { "title": ["Required"] }
  }
}
```

---

## Notification dedup keys

`data/notifications-sent.json` tracks which notifications have been sent. Keys:

| Trigger | Key format | Notes |
|---------|-----------|-------|
| Overdue | `{taskId}:overdue:{today-date}` | Re-alerts each day task stays overdue |
| Due today | `{taskId}:due-today:{due_date}` | Sent once per due date value |
| Due tomorrow | `{taskId}:due-tomorrow:{due_date}` | Sent once per due date value |

Keys for a task are cleared when its status moves to `done`.
