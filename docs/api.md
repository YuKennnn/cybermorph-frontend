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

### Development

The backend plan defines the frontend development origin as:

http://localhost:5173

However, the final FastAPI API base URL is not established by the backend plan alone.

Status: TO BE VERIFIED

The frontend must obtain the actual API base URL from the backend/deployment configuration rather than assuming it.

## 3. Authentication

### POST /auth/register

Purpose:
Register a Player account.

Authentication:
None.

Backend behavior:
Creates the required user, player profile, and role records atomically and writes an activity log.

Status:
PLANNED / BACKEND-DEFINED

### POST /auth/register-web

Purpose:
Register a web-portal user.

Authentication:
None.

Backend behavior:
- Validates the permitted email domain.
- Creates the appropriate web-user profile.
- Educator accounts are initially inactive and pending approval.
- Admin accounts are active immediately according to the backend plan.

Status:
PLANNED / BACKEND-DEFINED

### POST /auth/login

Purpose:
Authenticate a user and issue an access token.

Authentication:
None.

Backend behavior:
- Invalid credentials return a generic 401 response.
- Inactive accounts are rejected with 403.
- Login activity is logged.
- JWT-based authentication is used.

Status:
PLANNED / BACKEND-DEFINED

Exact request and response JSON fields:
TO BE VERIFIED against the actual FastAPI implementation/OpenAPI schema.

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

### POST /sessions/start

Purpose:
Start a player game session.

Authentication:
Player.

Backend behavior includes:

- Map validation
- Map progression/unlock checking
- Session creation

### PATCH /sessions/{id}/end

Purpose:
Finalize a game session.

Authentication:
Player.

Backend behavior includes:

- Session ownership verification
- Prevention of duplicate finalization
- Score calculation
- Leaderboard best-score update
- Player progression update
- Synchronization logging
- Atomic database writes

The backend preserves a rule that player progression must never decrease.

### GET /sessions/history

Purpose:
Retrieve the authenticated player's session history.

Authentication:
Player.

Backend behavior:
Returns the player's non-deleted sessions ordered by creation date.

## 6. Leaderboard

### GET /leaderboard

Purpose:
Retrieve leaderboard information.

Authentication:
None.

Supported query parameters:

- map_name
- search
- page
- page_size

Default page size:
10

Response:
Includes `total_count` so the frontend can determine pagination.

The leaderboard represents a player's best score per map rather than every session result.

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
Retrieve the authenticated web user's profile.

Authentication:
Web user.

The response includes the user's role.

### PATCH /web-users/me/last-login

Purpose:
Update the authenticated web user's last-login timestamp.

Authentication:
Web user.

## 9. Educator Analytics

### GET /analytics/classroom

Purpose:
Retrieve analytics for an educator-owned classroom.

Authentication:
Educator.

Query:
`code_id`

Analytics include information such as:

- Student count
- Average map progression
- Best-score statistics
- Per-category threat performance

The backend determines threat performance from synchronized `threat_attack_log` events.

### GET /analytics/player

Purpose:
Retrieve analytics for a specific student belonging to the educator.

Authentication:
Educator.

Query:
`profile_id`

Analytics include:

- Session history summary
- Wins and losses
- Average duration
- Best score per map
- Per-category threat performance
- Proficiency classification based on threat performance

### GET /analytics/session

Purpose:
Retrieve details for a particular game session.

Authentication:
Educator with appropriate access.

Query:
`session_id`

The response includes the individual threat events associated with the session.

## 10. Admin Endpoints

All `/admin/*` endpoints require explicit administrator authorization.

### GET /admin/users

Purpose:
Retrieve system users.

Supported query parameters:

- role
- search
- page

### PATCH /admin/users/{id}

Purpose:
Modify basic user information.

### DELETE /admin/users/{id}

Purpose:
Soft-delete a user.

### GET /admin/deleted-records

Purpose:
Retrieve soft-deleted records for administrative reclamation.

### POST /admin/deleted-records/{id}/restore

Purpose:
Restore a previously soft-deleted record.

### GET /admin/approvals

Purpose:
Retrieve pending educator approvals.

### POST /admin/approvals/{id}/approve

Purpose:
Approve an educator account.

Approval changes include:

- activating the user
- granting portal access
- setting approval status to approved

### POST /admin/approvals/{id}/reject

Purpose:
Reject an educator registration.

### GET /admin/classrooms

Purpose:
Retrieve classroom information across the system.

### PATCH /admin/classrooms/{id}

Purpose:
Modify administrative classroom settings, including activation state or ownership.

### DELETE /admin/classrooms/{id}

Purpose:
Soft-delete a classroom code.

### GET /admin/logs

Purpose:
Retrieve activity logs.

Supported query parameters include:

- action_type
- user_id
- page

### GET /admin/stats

Purpose:
Retrieve system-level statistics.

The planned statistics include:

- total_users
- active_sessions
- threats_detected
- server uptime

## 11. Synchronization Endpoints

Synchronization endpoints are intended for the Godot offline-first client.

### GET /sync/player-state

Purpose:
Retrieve the latest cloud player state for reconciliation with the local Godot database.

Authentication:
Player.

Planned response:

- map_progress
- threat_index
- updated_at

The endpoint no longer returns a persistent security-credit balance.

### POST /sync/session

Purpose:
Upload an offline game session to the cloud.

Authentication:
Player.

The client supplies a UUID-based session identifier.

The backend uses idempotent insertion so repeated synchronization attempts do not create duplicate session records.

### POST /sync/threat-index

Purpose:
Synchronize local Threat Index unlock records.

Authentication:
Player.

Synchronization is idempotent.

### POST /sync/threat-events

Purpose:
Synchronize threat attack events generated during offline gameplay.

Authentication:
Player.

The endpoint accepts multiple threat events associated with a game session.

Each event uses a client-generated identifier to support idempotent retries.

Synchronization records are tracked using the `sync_log`.

## 12. Authentication and Authorization Rules

The backend uses JWT-based authentication and role-aware authorization dependencies.

The backend distinguishes:

- authenticated user
- player
- web user
- admin

The planned authorization dependencies include:

- `get_current_user`
- `get_current_player`
- `get_current_web_user`
- `get_current_admin`

Frontend route guards must not be treated as a security boundary. Actual authorization is enforced by FastAPI.

## 13. Error Conventions

The backend plan specifies standardized HTTP error responses using the `detail` response shape.

Important status codes used throughout the API include:

- 400 — invalid request data
- 401 — unauthenticated / invalid credentials
- 403 — authenticated but unauthorized
- 404 — requested resource not found
- 409 — conflict with current resource state

The backend's error response structure must remain compatible with the Godot client's existing error extraction behavior.

Exact response schemas:
TO BE VERIFIED against the implemented FastAPI application.

## 14. Data and Synchronization Rules

The backend and frontend must follow the Data Dictionary as the source of truth for field names and database structures.

The backend plan specifically identifies several cross-system contracts that must remain consistent:

- User roles
- Threat taxonomy
- Map progression
- API request/response structures
- Synchronization payloads

The current backend plan identifies a map-order discrepancy between the backend and Godot client that must be resolved before synchronization is finalized.

## 15. Confirmed vs. To Be Verified

### Confirmed by Backend Plan

- Endpoint paths
- HTTP methods
- General endpoint purpose
- Authentication role requirements
- JWT-based backend authentication
- Player / educator / admin authorization model
- Synchronization endpoints
- Main API feature groups

### To Be Verified from Actual FastAPI Implementation

- Final API base URL
- Exact request schemas
- Exact response schemas
- Exact JWT payload fields
- Token expiration behavior
- Token transport/storage expectations
- Production CORS configuration
- Final deployed API URL
- Any endpoint behavior changed after this plan