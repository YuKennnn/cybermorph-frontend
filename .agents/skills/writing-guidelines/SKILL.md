---
name: writing-guidelines
description: Enforces technical writing, API documentation, domain terminology, and UI copy standards for CyberMorph based on the official API Guide and system architecture. Use when reviewing documentation, writing API guides, verifying UI text and error banners, or checking domain naming consistency.
metadata:
  category: documentation
  version: "2.0.0"
  argument-hint: <file-or-pattern>
---

# CyberMorph Writing & API Documentation Guidelines

This skill enforces technical writing precision, canonical domain vocabulary, UI messaging standards, and strict adherence to the backend API Guide across all documentation, UI text, error banners, and code comments in CyberMorph.

---

## 1. Core Principles

1. **Adhere to the Real Backend Contract**: Document only what exists in the backend implementation. Never speculate, assume endpoints, or describe hypothetical features as active.
2. **Honor Infrastructure Realities**: Acknowledge that the backend is hosted on a Render free tier with a 30–50 second cold start after ~15 minutes idle. Describe this transparently in UI notices and documentation; never categorize it as a system bug.
3. **Maintain User-Centric Error Tone**: Backend errors must be translated into clear, friendly, and actionable messages. Never expose raw backend exceptions, tracebacks, or JSON payloads to end users.
4. **Enforce Canonical Terminology & Clear UI Copy**: Maintain exact domain strings for roles, threat categories, simulation maps, and outcome states in all API requests, responses, and store logic. For user-facing portal UI, use clean sentence-case labels and plain language for navigation and actions (*"Educator overview"*, *"Create classroom"*, *"Threat analytics"*) while preserving canonical data integrity.

---

## 2. Canonical Domain Terminology & Enums

### User Roles
- **Player**: The game-client account. Enrolls via `POST /auth/register`. Role string: `"player"`.
- **Educator**: Institutional instructor account for the web portal. Registers via `POST /auth/register-web`. Role string: `"educator"`.
- **Admin**: System oversight with Level 0 authority. Created strictly via backend seeding/provisioning. Role string: `"admin"`. **Never describe admin accounts as self-service.**

### Institutional Constraints
- Educator registration emails **must strictly end in `@dnsc.edu.ph`**.
- Newly registered educator accounts default to `is_active: false` (`approval_status: "pending"`) and require administrator approval before portal login is permitted.
- Seeded test accounts for local/staging verification:
  - `admin@cybermorph.local`
  - `educator@cybermorph.local`

### The 8 Canonical DICT Threat Categories
When writing documentation, telemetry displays, or analytics summaries, threat categories must appear in this exact canonical order and spelling:
1. `Phishing`
2. `Smishing`
3. `Vishing`
4. `Social Engineering`
5. `Credential Theft / Weak Password Attack`
6. `Public Wi-Fi Attack`
7. `Malware Infection`
8. `Ransomware`

### Canonical Simulation Maps
Maps must be referenced by their exact names and canonical unlock progression:
1. `Home`
2. `Office`
3. `Internet Cafe`
4. `Public Park`

### Session Outcomes
Game session results are restricted to:
- `"win"`
- `"lose"`
- `"timeout"`

---

## 3. Backend & Network Documentation Rules

### Base URL & Environment
- Production Base URL: `https://cybermorph-backend.onrender.com`
- Swagger UI / OpenAPI docs: Available at `/docs` on the host.
- Environment Variable: Documented as `VITE_API_BASE_URL`. Code should fall back cleanly to the hosted URL if unset.
- **CORS**: Cross-Origin Resource Sharing is controlled exclusively by the backend's server-side `CORS_ORIGINS` environment variable on Render (e.g. `http://localhost:5173`). Do not write documentation suggesting CORS can be resolved via frontend client headers.

### Authentication Flow
- Single login endpoint for all users: `POST /auth/login` (`{ "email": "...", "password": "..." }`).
- Returns: `200 { "access_token": "<jwt>", "token_type": "bearer" }`.
- Header format: `Authorization: Bearer <access_token>`.
- Token lifespan: 30 days. No refresh endpoint exists; users re-authenticate upon expiration.
- Password requirements: Minimum 12 characters, including at least one uppercase letter, one lowercase letter, one digit, one special character, and maximum 72 bytes.

---

## 4. Error Shapes & UI Messaging Standards

All API errors return JSON with a top-level `"detail"` key. Documentation and error-handling code must distinguish these four distinct shapes:

| HTTP Status | Backend Payload Shape | UI Message Writing Rule |
|-------------|-----------------------|-------------------------|
| `401 Unauthorized` | `{"detail": "Could not validate credentials"}` or `{"detail": "Incorrect email or password"}` | Never reveal whether an email exists. State: *"Invalid email or password."* For expired sessions: *"Session expired. Please log in again."* |
| `403 Forbidden` | `{"detail": "<plain string>"}` | Inform user of access limits clearly (e.g., *"Account pending approval"*, *"Educator access required"*). |
| `404 Not Found` | `{"detail": "<plain string>"}` | State clearly what was not found (e.g., *"Classroom not found. Please verify the 6-character code."*). |
| `409 Conflict` | `{"detail": {"field": "<field>", "message": "<string>"}}` | **Nested object**. Extract `detail.message` and guide the user on resolving the conflict (e.g., duplicate username, already enrolled). |
| `422 Unprocessable` | FastAPI validation array: `[{ "loc": [...], "msg": "...", "type": "..." }]` | Extract `detail[0].msg` or format field-level validation feedback clearly. |

---

## 5. Telemetry & Analytics Nuances

When documenting or implementing analytics displays:
- **Missing vs. Zero**: In `/analytics/classroom`, unplayed maps are **absent** from `avg_best_score_by_map`. Threat categories without attempts have a value of `null`, **not** `0`. Always write UI copy presenting `null` as *"No attempts recorded yet"*, never as *"0% fail rate"*.
- **Empty Threat Events**: In `/analytics/session`, the `threat_events` array currently returns an empty list `[]` as backend telemetry writes are pending implementation. Document this as an expected empty state, never an error.
- **Client UUID & Datetime**: Sessions submitted via `POST /sessions` require a client-generated UUID `session_id` (for idempotent retry safety) and an ISO 8601 `played_at` timestamp with explicit timezone offset or `'Z'` suffix (naive datetimes trigger 422).

---

## 6. What NOT to Document or Assume as Active

Do not write guides, instructions, or features assuming the existence of:
- **Admin Endpoints (`/admin/*`)**: User management, educator approval actions, system logs, and stats endpoints are not yet built on the backend.
- **Offline Sync Endpoints (`/sync/*`)**: Exclusively reserved for future Godot client synchronization; do not integrate into the web portal.
- **Profile Mutations**: No endpoints currently exist for updating `display_name`, uploading profile avatars, or self-service password resets.

---

## 7. Review Checklist for Documentation & Copy

When using this skill to review any document or copy:
- [ ] Are all role names capitalized as Player, Educator, and Admin?
- [ ] Are threat categories using the exact 8 canonical strings?
- [ ] Are map names using Home, Office, Internet Cafe, and Public Park?
- [ ] Is educator email validation stated as `@dnsc.edu.ph`?
- [ ] Are error handlers accounting for nested 409 conflict objects?
- [ ] Are server wake-up times (30–50s) acknowledged for initial cold calls?
- [ ] Are unbuilt endpoints (admin, sync, profile edit) properly marked as pending or omitted?
- [ ] Are all findings formatted in clear `file:line` or section-by-section audit notes?
