# CyberMorph Frontend - Agent Instructions

## 1. Project Context

CyberMorph is an offline-first educational cybersecurity game.

The game is developed using Godot, while this Vue application
provides the web-based account and dashboard functionality.

The system has three user roles:

- player
- educator
- admin


## 2. Technology

This frontend currently uses:

- Vue 3
- Vite
- JavaScript
- Vue Router
- Pinia


## 3. Architecture Rules

- API communication should be separated from Vue components.
- Authentication state should be managed through Pinia.
- Vue Router is responsible for frontend navigation and client-side route protection.
- Client-side route protection must not be treated as a security boundary.
- Actual authentication and authorization must be enforced by the FastAPI backend.
- The frontend must not contain database logic.
- The frontend must communicate with the backend through its API.
- Treat documented API contracts and the actual backend implementation as the source of truth; do not invent endpoints, request fields, response fields, or authentication behavior.


## 4. Coding Rules

- Do not modify unrelated files.
- Prefer small, focused changes.
- Do not introduce new dependencies without justification.
- Follow the existing project structure before creating new structures.
- Do not assume undocumented backend API behavior.
- Do not put secrets in frontend source code.
- Backend repository files (`C:/Cyber-Morph/cybermorph-backend/`) are strictly read-only. Never attempt to edit, create, or delete backend files.


## 5. Learning Rule

The developer is learning software development and wants to
understand the architecture and reasoning behind changes.

For non-trivial changes:

1. Explain the problem.
2. Explain the proposed approach.
3. Identify the files that will change.
4. Implement only the approved task.
5. Explain what changed.
6. Provide verification steps.

Do not replace understanding with large unexplained code dumps.


## 6. Audience & Terminology Rules

- CyberMorph is designed for general players / users. Independent play is the default and complete experience.
- Students and educators are optional classroom users.
- In UI copy and public pages, use "For players" and "Optional classroom features".
- Do not imply that joining a classroom is required for gameplay or progress tracking.
- Use clear, academic language suitable for beginners. Avoid sci-fi or military jargon:
  - Use "classrooms" (not "classroom sectors")
  - Use "types of threats" (not "attack vectors")
  - Use "classroom management" (not "classroom oversight")
  - Use "common mistakes" (not "failure frequencies")
  - Use "student progress" or "player progress" (not "threat telemetry")
- In registration forms and account options, use "Player" (never "Student (Player)").
- Only describe capabilities supported by the actual game and backend API. Do not invent release details, hardware requirements, pricing, or analytics features.
- Preserve the meaning of API fields:
  - Sessions in the past 24 hours are recent sessions, not active sessions.
  - Threats detected (`threats_detected`) are threats detected, not threats completed or neutralized.
  - Do not present a score from recent session history as an all-time best score.


## 7. Context-Reading & Verification Requirement

Before proposing changes, creating implementation plans, or starting implementation on any task in this repository:

1. **Root Instructions & Inventory**: Read root `AGENTS.md` and inventory available skills (`.agents/skills/`) and docs (`docs/`).
2. **Relevant Skills & Documentation**: Read skills and documentation files relevant to the specific task at hand (e.g. `cybermorph-api-contract` for network/API changes, `cybermorph-ui-system` for UI changes, `pinia-store` for state management).
3. **Session Context Reuse**: When working in a continuous session, reuse unchanged context already read earlier rather than rereading identical, unmodified files in every turn.
4. **Backend Contract Verification**: For backend-facing work, consult the relevant sections of `C:/Cyber-Morph/cybermorph-backend/API_GUIDE.md` (read-only). Never invent unconfirmed request or response schemas.
5. **Inspect Affected Source Files**: Always inspect the actual source code files that will be modified or affected before proposing changes. Do not rely solely on memory or previous conversation summaries.
6. **Expanded Inspection for Audits**: Broaden file inspection across related skills, docs, and references when conducting comprehensive audits, refactoring cross-cutting architecture, resolving dependencies, or investigating conflicting evidence.
7. **Report Context & Discrepancies**: List the context files actually read. Report missing, empty, or conflicting documentation rather than guessing.
