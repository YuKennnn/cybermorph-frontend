# CyberMorph API Contract

## 1. API Overview

The CyberMorph web portal communicates with the FastAPI backend through HTTP-based API endpoints. The Vue.js frontend must not access the PostgreSQL database directly.

The API is organized by system feature:

- Authentication
- Players
- Sessions
- Leaderboard
- Classroom
- Educator / Web Users
- Administration
- Synchronization

The backend rewrite is designed as a feature-based asynchronous FastAPI application.

## 2. API Base URL

### Hosted Production Environment

The official FastAPI backend is deployed at:

```
https://cybermorph-backend.onrender.com/v1
```

All feature endpoints (`/auth`, `/players`, `/classroom`, `/analytics`, `/admin`, `/leaderboard`, `/sessions`) are relative to this `/v1` base URL.

Two resources intentionally remain at the host root (`https://cybermorph-backend.onrender.com`):
- **Interactive API Documentation & Schema**: Swagger UI at `/docs`, OpenAPI at `/openapi.json`
- **Application & API Version Negotiation**: `GET /app/version` (unversioned host root)
- **Cold Starts**: Render free-tier hosting spins down after ~15 minutes of idle time. The first request after idle requires 30–50 seconds to wake up. Frontend clients must handle this delay gracefully.
- **CORS Allowlist**: Cross-origin requests are governed by the server-side `CORS_ORIGINS` environment variable on Render (e.g. `http://localhost:5173`). Dev servers must be explicitly added to this allowlist on the server.

Status: CONFIRMED

## 3. Authentication

Authentication uses JWT bearer tokens. Tokens are valid for 30 days. There is no refresh token endpoint; users re-authenticate upon expiration.

Password complexity requirements (both roles): At least 12 characters, containing at least one uppercase letter, one lowercase letter, one digit, one special character, and maximum 72 bytes.

### POST /auth/register

Purpose:
Register a Player account.

Authentication:
None.

Request body:
```json
{
  "email": "player@example.com",
  "username": "AgentZero",
  "password": "Password123!#"
}
```

Response:
`201 { "user_id": "...", "email": "...", "username": "..." }`

Backend behavior:
Creates the user, player profile, and role atomically.

Status:
CONFIRMED

### POST /auth/register-web

Purpose:
Register an Educator web-portal account. (Admin accounts are never self-service).

Authentication:
None.

Constraint:
**Email must strictly end with `@dnsc.edu.ph`**.

Request body:
```json
{
  "email": "instructor@dnsc.edu.ph",
  "password": "Password123!#"
}
```

Response:
`201 { "user_id": "...", "email": "...", "approval_status": "pending" }`

Backend behavior:
- Validates institutional domain (`@dnsc.edu.ph`).
- Account starts with `is_active: false` and `approval_status: "pending"`.
- Cannot log in until administrative approval is granted.

Status:
CONFIRMED

### POST /auth/login

Purpose:
Authenticate user and issue access token for both players and web users.

Authentication:
None.

Request body:
```json
{
  "email": "user@example.com",
  "password": "Password123!#"
}
```

Response:
`200 { "access_token": "<jwt>", "token_type": "bearer" }`

Backend behavior:
- Missing/invalid credentials return `401 { "detail": "Incorrect email or password" }` or `401 { "detail": "Could not validate credentials" }`.
- Inactive/pending accounts return `403 { "detail": "Account is not active" }`.
- Token must be sent in subsequent requests via `Authorization: Bearer <access_token>`.

### Seeded Test Accounts

For local and testing environments:
- Admin: `admin@cybermorph.local` (Pre-approved: `approval_status: "approved"`, `portal_access: true`)
- Educator: `educator@cybermorph.local` (Pre-approved: `approval_status: "approved"`, `portal_access: true`)

Status:
CONFIRMED

## 4. Player Endpoints

### GET /players/me

Purpose:
Retrieve the authenticated player's profile.

Authentication:
Player.

### GET /players/threat-index

Purpose:
Retrieve the authenticated player's Threat Index.

Authentication:
Player.

Backend behavior:
If the player has no Threat Index records, the backend creates the eight standard threat entries before returning them.

Canonical threat order:

1. Phishing
2. Smishing
3. Vishing
4. Social Engineering
5. Credential Theft / Weak Password Attack
6. Public Wi-Fi Attack
7. Malware Infection
8. Ransomware

Status:
PLANNED / BACKEND-DEFINED

## 5. Session Endpoints

### POST /sessions

Purpose:
Submit or finalize a player game session.

Authentication:
Player token required.

Request body:
```json
{
  "session_id": "a3bb189e-8bf9-3888-9912-ace4e6543002",
  "map_name": "Office",
  "duration_seconds": 120,
  "credits_earned": 50,
  "credits_lost": 10,
  "false_positives": 0,
  "result": "win",
  "played_at": "2026-09-28T14:00:00+08:00"
}
```

Response:
`200 { "session": { ... }, "map_progress": 2 }`

Backend behavior & requirements:
- `session_id` must be a client-generated UUID. Resubmitting an identical UUID is a quiet, idempotent no-op (safe for offline retry).
- `map_name` must be one of `"Home"`, `"Office"`, `"Internet Cafe"`, `"Public Park"`. If the submitted map is not unlocked yet for the player, the session is stored but does not increment `map_progress` or the leaderboard.
- `result` must be `"win"`, `"lose"`, or `"timeout"`.
- `played_at` must include a timezone offset or `'Z'` suffix (naive datetimes return 422).

Status:
CONFIRMED

### GET /sessions/history

Purpose:
Retrieve paginated session history for the authenticated player (newest first).

Authentication:
Player token required.

Query parameters:
- `page` (default: 1, range 1–10000)
- `page_size` (default: 20, range 1–100)

Response:
`{ "items": [ ... ], "total_count": 42, "page": 1, "page_size": 20 }`

Status:
CONFIRMED

## 6. Leaderboard

### GET /leaderboard

Purpose:
Retrieve paginated leaderboard scores. Capped at top 50 per map.

Authentication:
None.

Supported query parameters:
- `map_name` (optional: "Home", "Office", "Internet Cafe", "Public Park")
- `page` (default 1)
- `page_size` (default 10)

*Note: The backend does not accept a `search` query parameter.*

Response:
Paginated envelope:
```json
{
  "items": [
    {
      "rank": 1,
      "score_id": "...",
      "username": "...",
      "total_score": 850,
      "map_name": "Office",
      "recorded_at": "..."
    }
  ],
  "total_count": 50,
  "page": 1,
  "page_size": 10
}
```

Status:
CONFIRMED

## 7. Classroom

### POST /classroom/generate

Purpose:
Generate a classroom code for an educator.

Authentication:
Web user with appropriate portal access.

Backend behavior:

- Generates a unique six-character classroom code.
- Requires active portal access.
- Records the action in the activity log.

### GET /classroom/my-codes

Purpose:
Retrieve classroom codes owned by the authenticated educator.

Authentication:
Web user.

Response includes:
- Classroom information
- Student count

### POST /classroom/join

Purpose:
Allow a Player to join a classroom using its code.

Authentication:
Player.

Possible backend outcomes:

- 404: classroom code not found
- 409: classroom code inactive
- 409: player already joined

Successful requests create a Player-Classroom association and activity-log entry.

### GET /classroom/{code_id}/students

Purpose:
Retrieve students associated with a classroom.

Authentication:
Educator / authorized web user.

Authorization:
The educator must own the classroom code.

Returned student information includes:

- profile_id
- username
- map_progress
- last_synced_at

### PATCH /classroom/{code_id}

Purpose:
Update classroom metadata or activation state.

Authentication:
Educator owner.

Possible updates:

- name
- description
- is_active

### DELETE /classroom/{code_id}

Purpose:
Soft-delete a classroom code.

Authentication:
Educator owner.

The backend records the deletion through the shared soft-delete mechanism and deleted-record log.

## 8. Educator / Web-User Endpoints

### GET /web-users/me

Purpose:
Retrieve the authenticated web user's profile (Educator or Admin).

Authentication:
Web user token required (`Authorization: Bearer <access_token>`).

Response:
```json
{
  "web_profile_id": "...",
  "user_id": "...",
  "email": "educator@dnsc.edu.ph",
  "role": "educator",
  "display_name": null,
  "portal_access": true,
  "approval_status": "approved",
  "last_login_at": "2026-09-28T14:00:00+08:00"
}
```

*Note: `display_name` is currently always `null` on the backend. No endpoints currently exist for updating `display_name`, uploading avatars, or password reset.*

Status:
CONFIRMED

## 9. Educator Analytics

### GET /analytics/classroom

Purpose:
Retrieve class-wide analytics summary for an educator-owned classroom.

Authentication:
Educator token required.

Query:
`code_id` (must be owned by authenticated educator)

Response:
```json
{
  "code_id": "...",
  "student_count": 3,
  "avg_map_progress": 1.33,
  "avg_best_score_by_map": { "Home": 723.3, "Office": 750.0 },
  "category_fail_rates": { "Phishing": 0.15, "Ransomware": null }
}
```

*Data nuances*:
- Unplayed maps are **absent** from `avg_best_score_by_map`.
- Unattempted threat categories are `null`, not `0`. The UI must render `null` as "no data recorded", never "0% fail rate".

Status:
CONFIRMED

### GET /analytics/player

Purpose:
Retrieve individual proficiency breakdown for a student enrolled in the educator's classroom.

Authentication:
Educator token required.

Query:
`profile_id` (must belong to educator's classroom)

Response:
```json
{
  "profile_id": "...",
  "wins": 4,
  "losses": 3,
  "avg_duration_seconds": 132.5,
  "best_score_by_map": { "Home": 800, "Office": 610 },
  "category_breakdown": { "Phishing": 0.10 },
  "recent_sessions": [
    {
      "session_id": "...",
      "map_name": "Office",
      "duration_seconds": 120,
      "credits_earned": 50,
      "credits_lost": 10,
      "false_positives": 0,
      "result": "win",
      "played_at": "2026-09-28T14:00:00+08:00"
    }
  ]
}
```

Status:
CONFIRMED

### GET /analytics/session

Purpose:
Retrieve detailed attack event telemetry for a specific session.

Authentication:
Educator token required.

Query:
`session_id` (must belong to one of educator's students)

Response:
```json
{
  "session_id": "...",
  "profile_id": "...",
  "username": "AgentZero",
  "map_name": "Office",
  "result": "lose",
  "threat_events": []
}
```

*Data nuances*:
- `threat_events` contains individual decision events uploaded for that session by the Godot game client via `POST /sync/threat-events` (oldest first).
- The list remains empty `[]` for older sessions or devices that have not synced events yet. The frontend must handle this as an expected empty state, not an error.

Status:
DOCUMENTED IN BACKEND CONTRACT

## 10. Admin Endpoints

The backend integration guide (`API_GUIDE.md`) documents 9 active administrative endpoints. All require an admin access token (`Authorization: Bearer <access_token>`).

> [!NOTE]
> **Implementation Status**: These endpoints are documented in the backend integration contract (`API_GUIDE.md`). Live endpoint behavior has not been independently verified via live test credentials by the frontend team.

### Documented Admin Routes

| Method | Path | Parameters / Body | Returns |
|---|---|---|---|
| `GET` | `/admin/users` | `?role=&search=&page=&page_size=` (`role`: `player`, `educator`, `admin`; default `page_size: 20`) | Paginated `{ user_id, email, role, username, display_name, is_active, created_at }`, newest first |
| `GET` | `/admin/approvals` | `?status=&page=&page_size=` (`status`: `pending` (default), `approved`, `rejected`; default `page_size: 20`) | Paginated `{ user_id, email, approval_status, created_at }`, oldest first |
| `POST` | `/admin/approvals/{user_id}/approve` | None | `200 { user_id, email, approval_status, created_at }` |
| `POST` | `/admin/approvals/{user_id}/reject` | None | `200 { user_id, email, approval_status, created_at }` |
| `GET` | `/admin/classrooms` | `?search=&page=&page_size=` (default `page_size: 20`) | Paginated `ClassroomResponse` plus `{ owner_user_id, owner_email, owner_display_name }`, newest first |
| `PATCH` | `/admin/classrooms/{code_id}` | Body: `{ is_active?, owner_user_id? }` (at least one required) | `200` with updated classroom object |
| `DELETE` | `/admin/classrooms/{code_id}` | None | `204` (no body) |
| `GET` | `/admin/logs` | `?action_type=&user_id=&page=&page_size=` (default `page_size: 20`) | Paginated `{ log_id, user_id, user_email, action_type, target_table, target_id, description, logged_at }`, newest first |
| `GET` | `/admin/stats` | None | `200 { total_users, sessions_last_24h, threats_detected, uptime_seconds }` |

### Documented Behavior Details
- **User Accounts (`/admin/users`)**: Lists all live accounts. `username` is present for players; `display_name` is present for web users (currently always `null`). `search` filters email, username, or display name case-insensitively.
- **Approval Review Queue (`/admin/approvals`)**: `pending` by default, ordered oldest first. Rejecting an account leaves the email registered so the user cannot re-register; an admin can approve previously rejected accounts later. Approve accepts `pending` or `rejected` registrations; Reject accepts `pending` only.
- **Classroom Oversight (`/admin/classrooms`)**: Lists all live classrooms across all educators. Admins can deactivate a class or transfer ownership to another approved educator via `PATCH`. An admin cannot rename a class. `DELETE` soft-deletes the classroom (`204`).
- **Audit Logs (`/admin/logs`)**: Paginated audit trail, newest first. Filterable by `user_id` (the actor) and `action_type`.
- **System Metrics (`/admin/stats`)**:
  - `total_users`: Total live user accounts.
  - `sessions_last_24h`: Completed sessions synchronized to the server within the past 24 hours (preserves metric meaning: recent sessions, not active concurrent sessions).
  - `threats_detected`: Total valid threats detected across uploaded gameplay events (preserves metric meaning: threats detected, not neutralized).
  - `uptime_seconds`: Time since backend process boot (resets on free-tier spin-up).

### Explicitly Unbuilt Endpoints (Do Not Integrate)
Per `API_GUIDE.md`, the following endpoints are **not yet built** on the backend:
- Modifying or deleting user accounts (`PATCH /admin/users/{id}`, `DELETE /admin/users/{id}`)
- Deleted-records inspection and restore screens (`GET /admin/deleted-records`, `POST /admin/deleted-records/{id}/restore`)
- Profile mutations (updating `display_name`, uploading avatars, self-service password reset)

## 11. Synchronization Endpoints

> [!NOTE]
> **Godot Game Client Exclusive**
> The `/sync/*` endpoints carry offline-to-online gameplay synchronization for the Godot mobile game client. The web portal does not call `/sync/*` directly; synchronized records are consumed by the portal via `/analytics/*` and `/players/*`. Sessions themselves are submitted via `POST /sessions`.

Documented synchronization routes:
- `GET /sync/player-state`: Pulls current cloud progress and threat unlocks for the authenticated player.
- `POST /sync/threat-events`: Uploads client-logged attack event telemetry (`1 to 100` events per batch) tied to a client UUID `session_id`.
- `POST /sync/threat-index`: Uploads newly unlocked canonical threat categories (`1 to 8` unlocks).

## 12. Authentication and Authorization Rules

The backend uses JWT-based authentication and role-aware authorization dependencies:
- `get_current_user`
- `get_current_player`
- `get_current_web_user`
- `get_current_admin`

Frontend route guards are strictly for UX navigation and must not be treated as a security boundary. Actual authorization is enforced by FastAPI.

## 13. Error Conventions

Every error response returns a JSON object with a top-level `"detail"` key:

| HTTP Status | Payload Shape | Meaning |
|---|---|---|
| `401` | `{"detail": "<plain string>"}` | Invalid credentials or missing/expired token |
| `403` | `{"detail": "<plain string>"}` | Authenticated but lacks permissions (e.g. `"Not a player account"`, `"Account is not active"`) |
| `404` | `{"detail": "<plain string>"}` | Resource not found (e.g. unknown classroom code) |
| `409` | `{"detail": {"field": "<field>", "message": "<msg>"}}` | **Nested object** tied to a specific field conflict (duplicate registration, already joined) |
| `422` | FastAPI validation array `[{ "loc": [...], "msg": "...", "type": "..." }]` | Request body or query parameters failed Pydantic validation |
| `500` | `{"detail": "Internal server error"}` | Unexpected server failure; display user-friendly retry notice |

## 14. Data Invariants

- **User Roles**: `player`, `educator`, `admin`
- **Canonical Threats**: Phishing, Smishing, Vishing, Social Engineering, Credential Theft / Weak Password Attack, Public Wi-Fi Attack, Malware Infection, Ransomware
- **Canonical Maps**: Home, Office, Internet Cafe, Public Park
- **Session Results**: `win`, `lose`, `timeout`

## 15. Documented Contract vs. Unbuilt Endpoints

### Documented in Integration Contract (`API_GUIDE.md`)
- API Base URL: `https://cybermorph-backend.onrender.com/v1` (Swagger UI at `/docs`, version negotiation at `/app/version`)
- 30-day JWT authentication via `POST /auth/login` (generic 401 on bad credentials)
- Player registration (`POST /auth/register`) & Educator registration (`POST /auth/register-web` with `@dnsc.edu.ph`)
- Seeded test accounts (`admin@cybermorph.local`, `educator@cybermorph.local`)
- Player profile & Threat Index (`GET /players/me`, `GET /players/threat-index`)
- Session submission (`POST /sessions` with client UUID) and history (`GET /sessions/history`)
- Leaderboard scores (`GET /leaderboard` with `map_name`, `page`, `page_size`; top 50 cap)
- Classroom management (`POST /classroom/generate`, `GET /classroom/my-codes`, `POST /classroom/join`, `GET /classroom/{code_id}/students`, `PATCH /classroom/{code_id}`, `DELETE /classroom/{code_id}`)
- Educator analytics (`GET /analytics/classroom`, `GET /analytics/player`, `GET /analytics/session`)
- Admin operations (`GET /admin/users`, `GET /admin/approvals`, `POST /admin/approvals/{id}/approve`, `POST /admin/approvals/{id}/reject`, `GET /admin/classrooms`, `PATCH /admin/classrooms/{id}`, `DELETE /admin/classrooms/{id}`, `GET /admin/logs`, `GET /admin/stats`)
- Godot sync endpoints (`GET /sync/player-state`, `POST /sync/threat-events`, `POST /sync/threat-index`)

### Explicitly Unbuilt on Backend (Do Not Implement or Assume)
- User profile modification or deletion (`PATCH /admin/users/{id}`, `DELETE /admin/users/{id}`)
- Deleted records log and restoration views (`GET /admin/deleted-records`, `POST /admin/deleted-records/{id}/restore`)
- Profile mutations (editing `display_name`, uploading profile avatars, self-service password reset)