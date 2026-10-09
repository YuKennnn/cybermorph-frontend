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
https://cybermorph-backend.onrender.com
```

- **Interactive API Documentation**: Swagger UI is available at `/docs` on the host.
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

*Note: `threat_events` currently returns an empty list `[]` as backend write operations to this table are pending implementation.*

Status:
CONFIRMED

## 10. Admin Endpoints

> [!WARNING]
> **Status: PLANNED / NOT YET BUILT ON LIVE BACKEND**
> As documented in `API_GUIDE.md`, all `/admin/*` endpoints (user management, educator approval, classroom oversight, system logs/stats) do NOT exist yet on the hosted server. Frontend code must not assume live server support for them.

The planned endpoints include:
- `GET /admin/users`
- `PATCH /admin/users/{id}`
- `DELETE /admin/users/{id}`
- `GET /admin/deleted-records`
- `POST /admin/deleted-records/{id}/restore`
- `GET /admin/approvals`
- `POST /admin/approvals/{id}/approve`
- `POST /admin/approvals/{id}/reject`
- `GET /admin/classrooms`
- `PATCH /admin/classrooms/{id}`
- `DELETE /admin/classrooms/{id}`
- `GET /admin/logs`
- `GET /admin/stats`

## 11. Synchronization Endpoints

> [!NOTE]
> **Status: PLANNED / GODOT CLIENT EXCLUSIVE**
> `/sync/*` endpoints are designed exclusively for the Godot offline-first game client and are not built or utilized by the web portal.

Planned endpoints:
- `GET /sync/player-state`
- `POST /sync/session`
- `POST /sync/threat-index`
- `POST /sync/threat-events`

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

## 14. Data Invariants

- **User Roles**: `player`, `educator`, `admin`
- **Canonical Threats**: Phishing, Smishing, Vishing, Social Engineering, Credential Theft / Weak Password Attack, Public Wi-Fi Attack, Malware Infection, Ransomware
- **Canonical Maps**: Home, Office, Internet Cafe, Public Park
- **Session Results**: `win`, `lose`, `timeout`

## 15. Confirmed vs. Pending

### Confirmed by Actual Backend Implementation
- API Base URL: `https://cybermorph-backend.onrender.com`
- Swagger UI at `/docs`
- 30-day JWT authentication via `POST /auth/login`
- Player registration (`POST /auth/register`) & Educator registration (`POST /auth/register-web` with `@dnsc.edu.ph`)
- Seeded test accounts (`admin@cybermorph.local`, `educator@cybermorph.local`)
- Player profile & Threat Index (`GET /players/me`, `GET /players/threat-index`)
- Unified session submission (`POST /sessions`) and history (`GET /sessions/history`)
- Leaderboard scores (`GET /leaderboard` with `map_name`, `page`, `page_size`)
- Classroom operations (`POST /classroom/generate`, `GET /classroom/my-codes`, `POST /classroom/join`, `GET /classroom/{code_id}/students`, `PATCH /classroom/{code_id}`, `DELETE /classroom/{code_id}`)
- Educator analytics (`GET /analytics/classroom`, `GET /analytics/player`, `GET /analytics/session`)
- Error shapes including nested 409 and 422 arrays

### Pending Backend Implementation
- Admin endpoints (`/admin/*`)
- Godot offline synchronization (`/sync/*`)
- Profile mutations (`display_name` editing, avatar uploading, password reset)
- Threat events logging into the `threat_events` table for session analytics