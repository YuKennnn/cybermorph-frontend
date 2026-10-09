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
  approves via `/admin/approvals/{id}/approve`. Admin accounts are active
  immediately per the backend plan.

### Auth mechanics (as implemented here)
- JWT bearer token. The request interceptor in `src/api/client.js` attaches
  `Authorization: Bearer <token>` from `localStorage.getItem('cyber_token')`.
- Pinia store `src/stores/authStore.js` holds token, user, and role, persisted
  in `localStorage` under `cyber_token`, `cyber_user`, `cyber_role`. Logout
  clears all three.
- Player registration: `POST /auth/register`. Web-user registration:
  `POST /auth/register-web`. Login: `POST /auth/login` (generic 401 on bad
  credentials — never reveal whether an email exists).

### Error conventions
All errors return a top-level `"detail"` key, but their exact structure depends on status:

| Status | Backend Shape | Meaning in CyberMorph |
| ------ | ------------- | --------------------- |
| 401    | `{"detail": "<string>"}` | Invalid credentials or expired/missing token |
| 403    | `{"detail": "<string>"}` | Wrong role, inactive/pending educator, or unowned resource |
| 404    | `{"detail": "<string>"}` | Resource not found (e.g., unknown classroom code) |
| 409    | `{"detail": {"field": "<field>", "message": "<msg>"}}` | **Nested object** conflict (duplicate registration, already joined) |
| 422    | FastAPI validation array `[{loc, msg, type}]` | Request body or query params failed validation |

Show friendly user-facing messages; never render raw backend error payloads.

### Endpoint groups (summary — details in docs/api.md)
- **Base URL**: `https://cybermorph-backend.onrender.com` (Swagger UI at `/docs`). 30–50s cold start on idle wake-up.
- **Auth**: `POST /auth/register` (player), `POST /auth/register-web` (educator, `@dnsc.edu.ph` required, pending admin approval), `POST /auth/login` (30-day Bearer token, no refresh endpoint).
- **Players**: `GET /players/me`, `GET /players/threat-index` (creates 8 canonical entries on first call).
- **Sessions**: `POST /sessions` (submits completed session; requires client-generated UUID `session_id`, timezone-aware `played_at`, returns `{session, map_progress}`), `GET /sessions/history` (paginated).
- **Leaderboard**: `GET /leaderboard` with `map_name`, `page`, `page_size` (default 10; capped at top 50 per map; returns `items` and `total_count`).
- **Classroom**: `POST /classroom/generate` (6-char code), `GET /classroom/my-codes` (flat array of `ClassroomResponse`), `POST /classroom/join` (player), `GET /classroom/{code_id}/students` (owner-only, paginated), `PATCH /classroom/{code_id}` (name, description, is_active), `DELETE /classroom/{code_id}` (soft delete).
- **Web users**: `GET /web-users/me` (`display_name` is currently null; no avatar or profile update endpoint exists).
- **Analytics**: `GET /analytics/classroom?code_id=`, `GET /analytics/player?profile_id=`, `GET /analytics/session?session_id=` (`threat_events` currently returns `[]`).
- **Not yet built in backend**: Admin endpoints (`/admin/*`) and offline sync (`/sync/*`) do NOT exist yet. Do not assume live server support for them.

### Cross-repository invariants (shared with Godot + FastAPI — never drift)
- Threat taxonomy, canonical order: Phishing, Smishing, Vishing, Social
  Engineering, Credential Theft / Weak Password Attack, Public Wi-Fi Attack,
  Malware Infection, Ransomware.
- Map ordering: Home, Office, Internet Cafe, Public Park.
- Session outcomes: `win`, `lose`, `timeout`.
- Soft deletion uses `deleted_at` / `deleted_by`.

### Dev mode and configuration
- `src/main.js` dynamically imports `src/api/mock.js` in DEV only. The mock
  uses `axios-mock-adapter` with `onAny().passThrough()` last, so unmatched
  requests hit the real base URL.
- `src/api/client.js` defaults to `https://cybermorph-backend.onrender.com` or
  reads `import.meta.env.VITE_API_BASE_URL`.
- CORS must be configured on Render via `CORS_ORIGINS`, not in frontend code.

## Instructions

1. **Source of truth first.** Read `docs/api.md` (and `docs/authentication.md`
   for auth work) before any backend-facing change. Implement only confirmed
   endpoints, fields, and behavior. If a schema is undocumented, stop and flag
   it as TO BE VERIFIED instead of guessing (ADR-006).
2. **Layering.** New API calls live in a dedicated module under `src/api/`
   following the pattern in `analytics.js` / `classroom.js`: exported async
   functions with JSDoc noting the endpoint and response shape. Views and
   stores call those functions. Never add database concepts to the frontend.
3. **Client and token handling.** Always import `apiClient` from
   `src/api/client.js` so the bearer interceptor applies. On a 401 from a
   protected call, clear auth state (`authStore.logout()`) and redirect to
   `/login`. Never log tokens or sensitive payloads; never put secrets in
   frontend source.
4. **Error UX.** Catch errors per action and map status codes to friendly
   messages using the existing banner classes. Distinguish 404 vs 409 where
   behavior differs (e.g., classroom join). Never expose raw `detail` dumps.
5. **Mock parity.** Any endpoint added or changed must be mirrored in
   `src/api/mock.js` with realistic stateful data including its error paths
   (401/404/409), so `npm run dev` demos work without the backend. Keep
   `onAny().passThrough()` last.
6. **Configuration.** Use `import.meta.env.VITE_API_BASE_URL` for the base URL
   in new configuration work; update `.env.example` if introducing new vars.
7. **Dependencies.** No new packages without explicit justification
   (per AGENTS.md).
8. **Verify.** Run `npm run lint` (must finish with 0 errors) and
   `npm run build`. In the summary, list endpoints touched, fields consumed,
   and every contract assumption flagged TO BE VERIFIED.

For non-trivial changes, follow the AGENTS.md learning rule: explain the
problem, approach, files changed, implementation, what changed, and verification
steps. No unexplained code dumps.
