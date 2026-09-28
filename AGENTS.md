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