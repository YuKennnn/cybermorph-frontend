# CyberMorph Security Architecture

## 1. Security Overview

CyberMorph follows a layered security approach in which the client applications communicate with a protected FastAPI backend, while PostgreSQL remains behind the backend service.

The primary security boundary is the FastAPI backend.

The Vue.js Web Portal and Godot client are considered client applications and must not be trusted to make final authorization decisions.

Conceptually:

Client
  |
  v
FastAPI Security Boundary
  |
  +-- Authentication
  +-- Authorization
  +-- Input Validation
  +-- Business Rules
  +-- Database Access
  |
  v
PostgreSQL

## 2. Authentication Security

The backend uses:

- JWT-based authentication
- bcrypt password hashing
- role-aware authorization dependencies

Passwords must never be stored in plaintext.

Authentication failures must avoid revealing whether a specific email address exists.

## 3. Authorization and RBAC

Role-Based Access Control is enforced on the backend.

The primary roles are:

- Player
- Educator
- Admin

The backend uses separate authorization dependencies to enforce access boundaries.

Frontend route guards are not considered a security mechanism by themselves.

## 4. Frontend Security Boundary

The Vue frontend is an untrusted client environment.

Users can inspect frontend JavaScript, modify client state, and send requests independently of the Vue interface.

Therefore:

- UI restrictions are not authorization.
- Role values shown by the frontend are not inherently trustworthy.
- Hidden routes are not protected server resources.
- Client-side validation cannot replace backend validation.

Sensitive operations must always be validated by FastAPI.

## 5. API Security

All protected API requests must be authenticated according to the backend's authentication mechanism.

The backend validates:

- Authentication state
- User identity
- User role
- Resource ownership
- Request data
- Business rules

Examples include:

- A Player may access Player-specific endpoints.
- An Educator may access only classrooms and student data they are authorized to view.
- An Admin may access administrative endpoints.
- A user must not access another user's protected data merely by changing an identifier in a request.

## 6. CORS

The backend uses CORS to control which web origins are permitted to communicate with the API.

CORS origins must be configuration-driven rather than hardcoded into application logic.

Wildcard origins must not be used for production deployment.

The exact production origins must be confirmed through deployment configuration.

## 7. HTTPS and Network Security

Deployed communication between clients and the backend should use HTTPS.

HTTPS protects data transmitted between:

- Vue Web Portal and FastAPI
- Godot client and FastAPI

Sensitive authentication information must not be transmitted through insecure production connections.

The precise deployment and TLS configuration is controlled by the backend/deployment environment.

## 8. Secrets and Credentials

Secrets must not be committed to source control.

Sensitive values include:

- JWT secrets
- Database credentials
- Seed passwords
- Private API credentials
- Other service secrets

Environment variables and deployment secret-management facilities should be used instead.

The backend plan identifies a previous serious issue in which seed account passwords were hardcoded in a public repository. Those credentials must be treated as compromised if they were ever deployed and should be rotated.

## 9. API Keys

The Vue frontend must not contain a secret API key that is intended to remain confidential.

Anything shipped to a browser can potentially be inspected by the user.

If a service requires a private credential, that operation should generally be performed through a trusted backend/service boundary rather than exposing the credential in the frontend.

Whether CyberMorph requires any API keys beyond its JWT authentication system is not established by the backend plan.

Status:
TO BE VERIFIED.

## 10. Input Validation

Client-side validation improves usability but is not sufficient for security.

All security-sensitive validation must be repeated by FastAPI.

Examples include:

- Registration data
- Login credentials
- Classroom codes
- Session values
- Resource identifiers
- Administrative operations
- Synchronization payloads

The backend must reject malformed or unauthorized input before database changes occur.

## 11. Data Integrity

The backend plan requires transactional and integrity protections for important operations.

Examples include:

- Atomic registration writes
- Atomic session finalization
- Prevention of duplicate session finalization
- Non-decreasing map progression
- Best-score-only leaderboard updates
- Idempotent synchronization

These protections prevent inconsistent data caused by retries, invalid requests, or client-side manipulation.

## 12. Synchronization Security

Offline synchronization introduces an additional trust boundary because data originates from the player's device.

The backend must therefore authenticate and authorize synchronization requests rather than blindly trusting locally stored data.

The synchronization design also uses client-generated identifiers and idempotent operations to prevent repeated uploads from creating duplicate records.

The planned sync endpoints are:

- `GET /sync/player-state`
- `POST /sync/session`
- `POST /sync/threat-index`
- `POST /sync/threat-events`

## 13. Error Handling

The backend should return safe error responses without exposing implementation details.

Unhandled exceptions should not expose:

- Stack traces
- Internal database details
- Secrets
- Server paths
- Sensitive application state

The backend plan standardizes error responses around the `detail` field.

The frontend should present user-friendly messages rather than exposing raw internal errors.

## 14. Soft Deletion and Auditability

Soft-deletable records use:

- `deleted_at`
- `deleted_by`

The backend requires active queries to exclude soft-deleted records unless the operation is explicitly an administrative reclamation/audit operation.

Deleted records are additionally tracked through the deleted-records log.

Important administrative actions are recorded through `activity_log`.

## 15. Cross-Role Security Testing

Security testing must include attempts to access resources across roles.

Examples:

- Player → Educator endpoint
- Player → Admin endpoint
- Educator → Player-only endpoint
- Educator → Admin endpoint
- Admin → authorized administrative endpoint

Tampered authentication tokens must also be tested.

The backend plan requires this authorization audit across the API.

## 16. Frontend Security Responsibilities

The frontend is responsible for:

- Handling authentication state appropriately
- Avoiding exposure of secrets
- Sending requests through the API layer
- Handling authentication failures
- Protecting client-side navigation
- Avoiding sensitive information in console logs
- Providing safe user-facing error messages

The frontend is not responsible for:

- Direct database access
- Final authorization decisions
- Password hashing
- JWT secret management
- Server-side permission enforcement

## 17. Security Unknowns / To Be Verified

The following require confirmation from the implemented system:

- Final token storage strategy
- Refresh-token implementation, if any
- Exact HTTPS deployment architecture
- Rate limiting
- CSRF protection requirements, depending on final authentication transport
- API-key usage, if any
- Abuse/rate-limit handling
- Production secret-management service
- Exact synchronization authenticity/integrity protections