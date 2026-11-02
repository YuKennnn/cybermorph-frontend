---
name: cybermorph-api-contract
description: Load when working on CyberMorph frontend API integration — anything touching src/api/, src/stores/authStore.js, auth/login/register flows, error handling, mock data, or any view or store that fetches backend data. Enforces the documented FastAPI contract and prevents invented endpoints, fields, or auth behavior.
metadata:
  category: api
---

# CyberMorph API Contract Guardian

The Vue portal is one client of the FastAPI backend (alongside the Godot game).
It never touches PostgreSQL directly, and its route guards are UX only — never a
security boundary. The most expensive bugs in this repo are contract bugs, so
implement only what the docs confirm.

## Knowledge

### Roles and authorization
- Three roles: `player`, `educator`, `admin`.
- Backend enforces roles via dependencies (`get_current_player`,
  `get_current_web_user`, `get_current_admin`). Frontend role checks are
  convenience only.
- Educator approval workflow: `POST /auth/register-web` creates an **inactive**
  educator with `pending` status; login attempts return **403** until an admin
  approves via `POST /admin/approvals/{id}/approve`. Admin accounts are active
  immediately per backend plan.

### Auth mechanics (as implemented here)
- JWT bearer token. The request interceptor in `src/api/client.js` attaches
  `Authorization: Bearer <token>` from `localStorage.getItem('cyber_token')`.
- Pinia store `src/stores/authStore.js` holds token, user, and role, persisted
  in `localStorage` under `cyber_token`, `cyber_user`, `cyber_role`. Logout
  clears all three and resets domain stores.
- Player registration: `POST /auth/register` (`email`, `username`, `password`).
- Web-user registration: `POST /auth/register-web` (`email` with `@dnsc.edu.ph`, `password`, and required `display_name`).
- Login: `POST /auth/login` (`email`, `password`) returns `{ access_token, token_type: "bearer" }`. Generic 401 on bad credentials — never reveal whether an email exists. No refresh token exists; token lasts 30 days.

### Error conventions
All errors return a top-level `"detail"` key, but their exact structure depends on status:

| Status | Backend Shape | Meaning in CyberMorph |
| ------ | ------------- | --------------------- |
| 401    | `{"detail": "<string>"}` | Invalid credentials or expired/missing token |
| 403    | `{"detail": "<string>"}` | Wrong role, inactive/pending educator, or unowned resource |
| 404    | `{"detail": "<string>"}` | Resource not found (e.g., unknown classroom code) |
| 409    | `{"detail": {"field": "<field>", "message": "<msg>"}}` | **Nested object** conflict (duplicate registration, already in classroom, missing display name) |
| 422    | FastAPI validation array `[{loc, msg, type}]` | Request body or query params failed validation |
| 500    | `{"detail": "Internal server error"}` | Unexpected server failure |

Show friendly user-facing messages; never render raw backend error payloads.

### Pagination & Query Envelope
Every paginated endpoint uses the envelope:
```json
{ "items": [...], "total_count": 42, "page": 1, "page_size": 20 }
```
Controlled by query params `?page=` (1–10000, default 1) and `?page_size=` (1–100, default endpoint-specific). Out-of-range values produce 422, not clamping.

### Endpoint groups (stable rules — details in API_GUIDE.md and docs/api.md)
For full, authoritative endpoint schemas, parameters, and status codes, reference `C:/Cyber-Morph/cybermorph-backend/API_GUIDE.md` and `docs/api.md`.
- **Base URL**: `https://cybermorph-backend.onrender.com/v1` (Swagger UI at `/docs`, version check at `/app/version`). 30–50s cold start on idle wake-up.
- **Auth**: `POST /auth/register` (player), `POST /auth/register-web` (educator, `@dnsc.edu.ph` required, `display_name` required), `POST /auth/login` (30-day Bearer token, no refresh endpoint).
- **Players**: `GET /players/me` (includes `classroom_name`), `GET /players/threat-index` (creates 8 canonical entries on first call).
- **Sessions**: `POST /sessions` (submits completed session; requires client-generated UUID `session_id`, timezone-aware `played_at`, optional `credits_left`; returns `{session, map_progress}`), `GET /sessions/history` (paginated, player only).
- **Leaderboard**: `GET /leaderboard` with `map_name`, `page`, `page_size` (default 10; capped at top 50 per map; returns `items` and `total_count`).
- **Classroom**:
  - Educator: `POST /classroom/generate` (requires non-null `display_name`; 409 if unset), `GET /classroom/my-codes` (flat array of `ClassroomResponse`), `GET /classroom/{code_id}/students` (owner-only, paginated), `PATCH /classroom/{code_id}` (`name`, `description`, `is_active`), `DELETE /classroom/{code_id}` (soft delete).
  - Player: `POST /classroom/join` (player can join at most one classroom; returns 409 if already in a class), `GET /classroom/mine` (`200` with `MyClassroomResponse` or `404`), `DELETE /classroom/mine` (`204` leave class or `404`).
- **Web users**:
  - `GET /web-users/me`: returns `{web_profile_id, user_id, email, role, display_name, portal_access, approval_status, last_login_at}`. Legacy educators may have `display_name: null`.
  - `PATCH /web-users/me`: updates `{display_name}` (required 1–100 chars, single-line, trimmed; cannot be set to null or cleared).
- **Analytics (educator only)**:
  - `GET /analytics/classroom?code_id=`: summary of educator-owned class (`avg_map_progress`, `avg_best_score_by_map`, `category_fail_rates`).
  - `GET /analytics/player?profile_id=`: individual student summary (`recent_sessions`, `map_progress`, 8-element `threat_index`).
  - `GET /analytics/session?session_id=`: session threat events (`threat_events` reflects decisions uploaded by Godot via `POST /sync/threat-events`; empty `[]` if unsynced).
- **Admin**:
  - `GET /admin/users`, `GET /admin/approvals`, `POST /admin/approvals/{user_id}/approve`, `POST /admin/approvals/{user_id}/reject`
  - `GET /admin/classrooms`, `PATCH /admin/classrooms/{code_id}` (body accepts `{is_active}` **only**; `owner_user_id` is rejected with 422), `DELETE /admin/classrooms/{code_id}`
  - `GET /admin/logs`, `GET /admin/stats`
  - `GET /admin/play-data`, `GET /admin/play-data/{upload_id}` (decision logs from Godot testers; web portal teachers do not use these).
- **Offline sync (Godot client exclusive)**: `GET /sync/player-state`, `POST /sync/threat-events`, `POST /sync/threat-index`, `POST /sync/play-data`. The web portal never calls sync endpoints directly.
- **Not yet built in backend**: Modifying or deleting users (`PATCH/DELETE /admin/users/{id}`), deleted-records restore screens (`/admin/deleted-records`), profile avatars, self-service password reset.

### Semantic Invariants & Data Nuances
- **Null vs Zero**:
  - `category_fail_rates`: `null` means unattempted/no data yet, NOT a `0%` fail rate.
  - `threat_unlocked_count`: `0` could mean never synced (`last_synced_at === null`) or synced with zero unlocks.
  - `credits_left`: `null` means unrecorded or old client build, NOT `0` credits.
- **Timestamps**:
  - Submissions (`played_at`, `logged_at`, `unlocked_at`) require ISO 8601 strings with timezone offset or `'Z'`.
  - Backend response timestamps like `unlocked_at` may come as naive UTC (e.g. `"2026-10-28T08:00:00"`). JavaScript parsing requires appending `'Z'` before creating `new Date(value + 'Z')` to avoid browser local timezone shifting.
- **Threat categories (8 canonical, exact spelling & order)**:
  1. `Phishing`, 2. `Smishing`, 3. `Vishing`, 4. `Social Engineering`, 5. `Credential Theft`, 6. `Public Wi-Fi Attack`, 7. `Malware Infection`, 8. `Ransomware`.
- **Map progression (0-based integer 0–3)**:
  0. `Home`, 1. `Office`, 2. `Internet Cafe`, 3. `Public Park`. Maps with index <= `map_progress` are unlocked.

### Dev mode and configuration
- `src/main.js` dynamically imports `src/api/mock.js` only when in development mode (`import.meta.env.DEV`) AND `import.meta.env.VITE_USE_MOCK === 'true'`.
- `src/api/client.js` defaults to `https://cybermorph-backend.onrender.com/v1` or reads `import.meta.env.VITE_API_BASE_URL`.
- CORS is configured on Render via `CORS_ORIGINS`, not in frontend code.

## Instructions

1. **Source of truth first.** Consult `C:/Cyber-Morph/cybermorph-backend/API_GUIDE.md` and `docs/api.md` before any backend-facing change. Implement only confirmed endpoints, fields, and behaviors. Flag undocumented items as TO BE VERIFIED (ADR-006).
2. **Layering.** New API calls live in a dedicated module under `src/api/` (e.g. `src/api/auth.js`, `src/api/classroom.js`). Export async functions with JSDoc describing endpoints and shapes. Views and stores call those functions. Never add database logic to the frontend.
3. **Client and token handling.** Import `apiClient` from `src/api/client.js` so the bearer interceptor applies. On a 401 from a protected call, clear auth state (`authStore.logout()`) and redirect to `/login`. Never log tokens or sensitive payloads; never put secrets in frontend source.
4. **Error UX.** Catch errors per action and map status codes to friendly messages using existing banner classes. Distinguish 404 vs 409 where behavior differs. Handle nested 409 `{ detail: { field, message } }` properly. Never expose raw `detail` dumps.
5. **Mock parity.** When mock testing is needed, mirror added or changed endpoints in `src/api/mock.js` with realistic stateful data and error branches (401/404/409). Keep `onAny().passThrough()` last.
6. **Configuration.** Use `import.meta.env.VITE_API_BASE_URL` for the base URL; update `.env.example` if introducing new variables.
7. **Verify with non-fixing commands.** Run non-fixing linting and verification:
   ```powershell
   npx oxlint .
   npx eslint .
   ```
   Do not run auto-fixing commands that mutate files unexpectedly during verification.
