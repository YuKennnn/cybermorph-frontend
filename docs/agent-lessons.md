# CyberMorph Agent Lessons & Verified Insights

> [!NOTE]
> **Status & Priority**: This document serves as **project reference material**, not a higher-priority instruction source. Root agent instructions (`AGENTS.md`) and official architecture decisions ([decisions.md](file:///c:/Cyber-Morph/cybermorph-frontend/docs/decisions.md)) always take precedence. Load relevant lessons on demand when working in related functional areas rather than rereading this entire document for every task.

This repository records only verified, project-specific lessons and recurring tooling/contract constraints.

---

## 1. Tooling & Verification Constraints

### Non-Fixing Lint Verification
- **Lesson**: Running `npm run lint` executes `oxlint . --fix` and `eslint . --fix --cache`, which automatically mutates source files. When verifying code changes, always use non-fixing commands (`npx oxlint .` and `npx eslint .`).
- **Supporting Source**: `package.json` (`scripts.lint`, `scripts["lint:oxlint"]`, `scripts["lint:eslint"]`).
- **Date Verified**: 2026-11-01
- **When It Applies**: Verification steps in skills, CI documentation, and terminal inspection.

### Mock Activation Dual Condition
- **Lesson**: The frontend mock adapter (`src/api/mock.js`) is only activated when running in Vite development mode **and** `VITE_USE_MOCK === 'true'`. If either condition is false, requests hit the live API base URL.
- **Supporting Source**: `src/main.js` (`if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === 'true')`).
- **Date Verified**: 2026-11-01
- **When It Applies**: Debugging API failures, offline testing, and configuring `.env`.

---

## 2. Authentication & State Invariants

### Never Default Unresolved Roles to Player
- **Lesson**: Unresolved or in-flight authentication states must never fall back or default to the `'player'` role. If an account's role cannot be verified against `GET /web-users/me` or `GET /players/me`, user state must remain `null` or be invalidated. Defaulting to player causes unauthorized requests and incorrect UI routing for educator and admin accounts.
- **Supporting Source**: `src/stores/authStore.js` (`resolveProfile()`), [ADR-003](file:///c:/Cyber-Morph/cybermorph-frontend/docs/decisions.md#adr-003-pinia-for-authentication-state).
- **Date Verified**: 2026-11-01
- **When It Applies**: Modifying `src/stores/authStore.js`, route guards, or session handling.

### Session Isolation & Concurrency Guards
- **Lesson**: Pinia domain stores (`classroomStore`, `threatIndexStore`, `playerClassroomStore`) must be reset on `logout()` and `login()` to prevent data from previous sessions leaking across account switches. Furthermore, asynchronous actions must check session epoch tokens (`sessionEpoch`) to discard delayed responses from previous logins.
- **Supporting Source**: `src/stores/authStore.js` (`sessionEpoch`, `logout()`, `login()`).
- **Date Verified**: 2026-11-01
- **When It Applies**: Creating or refactoring Pinia state stores.

---

## 3. Backend Contract & Schema Constraints

### Educator Registration & Display Name
- **Lesson**: `POST /auth/register-web` requires `{ email, password, display_name }`. An educator cannot create classrooms (`POST /classroom/generate`) without a valid `display_name` (returns nested 409 error `{ detail: { field: "display_name", ... } }`). Legacy educators without names must be prompted to update via `PATCH /web-users/me`.
- **Supporting Source**: `C:/Cyber-Morph/cybermorph-backend/API_GUIDE.md` (Web-users and Classroom sections).
- **Date Verified**: 2026-11-01
- **When It Applies**: Educator onboarding, classroom generation, profile settings.

### Immutable Classroom Ownership
- **Lesson**: `PATCH /admin/classrooms/{code_id}` only accepts `{ is_active }`. Passing any other field (such as `owner_user_id`) produces a `422 Unprocessable Entity`. Classrooms cannot be reassigned to another educator; admin controls are limited to activating, deactivating, or soft-deleting.
- **Supporting Source**: `C:/Cyber-Morph/cybermorph-backend/API_GUIDE.md` (Admin section, 2026-10-25 contract update).
- **Date Verified**: 2026-11-01
- **When It Applies**: Admin classroom management views and actions.

### Null vs. Zero Semantic Distinction
- **Lesson**: In analytics endpoints (e.g. `GET /analytics/classroom`), unattempted threat categories return `null`, not `0.0`. UI copy must display "No attempts recorded yet", not "0% fail rate". Similarly, `last_synced_at === null` in student rosters indicates the student has never synced, which must be distinguished from zero unlocks.
- **Supporting Source**: `C:/Cyber-Morph/cybermorph-backend/API_GUIDE.md` (Analytics section), [ADR-006](file:///c:/Cyber-Morph/cybermorph-frontend/docs/decisions.md#adr-006-do-not-invent-api-contracts).
- **Date Verified**: 2026-11-01
- **When It Applies**: Rendering analytics cards, student tables, and progress indicators.
