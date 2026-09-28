# CyberMorph Authentication

## 1. Authentication Overview

CyberMorph uses centralized backend authentication through the FastAPI backend.

The Vue.js Web Portal does not authenticate users directly against the PostgreSQL database. Instead, credentials are submitted to FastAPI, where authentication is performed and an access token is issued upon successful authentication.

The Godot client may also require authentication when a Player chooses to use online functionality. The exact Godot-to-web authentication handoff mechanism is a cross-repository implementation detail and must be confirmed against the actual Godot and backend implementations.

Authentication and authorization are separate concerns:

- Authentication determines whether the submitted credentials identify a valid user.
- Authorization determines what the authenticated user is permitted to access.

## 2. User Roles

CyberMorph defines three primary roles:

- Player
- Educator
- Admin

The role assigned to a user determines the backend authorization scope available to that user.

### Player

Players primarily interact with the Godot game and may also access player-related functionality through the Web Portal.

Player-specific backend operations use player authorization.

### Educator

Educators use the Web Portal for classroom and student-monitoring functionality.

Educator accounts are subject to the approval workflow defined by the backend.

### Admin

Admins have system-level access to administrative Web Portal functionality.

Admin access requires explicit administrative authorization.

## 3. Player Registration

Player registration is performed through:

`POST /auth/register`

Authentication:
None.

The backend registration operation creates the required account-related records atomically.

The planned operation includes:

- User record
- Player profile
- User-role assignment
- Activity-log entry

Duplicate account information must result in an appropriate conflict response.

Exact request and response schemas must be verified against the implemented backend.

## 4. Web-User Registration

Web users register through:

`POST /auth/register-web`

Authentication:
None.

The backend distinguishes web-user roles and applies additional registration rules.

The planned educator registration workflow includes:

1. Validate the permitted institutional email domain.
2. Create the web-user profile.
3. Assign the educator role.
4. Set the educator account to inactive.
5. Set the approval status to `pending`.
6. Prevent login until the account has been approved.

Admin registration behavior differs because the backend plan specifies that administrative accounts are active immediately according to the registration rules.

Exact role-selection rules and request fields must be verified against the implemented backend.

## 5. Login

Users authenticate through:

`POST /auth/login`

Authentication:
None.

Conceptual flow:

User
  |
  | email + password
  v
Vue Web Portal
  |
  | POST /auth/login
  v
FastAPI
  |
  | locate active account
  | verify password
  | determine role
  v
Authentication result
  |
  | access token
  v
Vue Web Portal

The backend uses bcrypt for password verification and JWT-based access tokens for authenticated requests.

Invalid credentials must produce a generic authentication failure rather than revealing whether an email address exists.

Inactive accounts must not be permitted to authenticate.

## 6. Token

The backend plan specifies JWT-based authentication.

The access token is used to prove that subsequent protected API requests are associated with an authenticated user.

The frontend must treat the token as sensitive authentication material.

The exact JWT payload fields, token type, expiration behavior, and frontend persistence strategy must be verified against the implemented backend.

The frontend must not assume a token field name or token structure that is not defined by the actual API contract.

## 7. Authentication State in the Frontend

The Vue application uses Pinia as the central mechanism for representing authentication state.

The authentication state may include information such as:

- Authentication status
- Current user information
- Current role
- Access token or authentication state reference

The exact state model should be derived from the finalized backend authentication response.

Pinia is responsible for application-wide authentication state.

It is not itself the source of truth for server-side authorization.

## 8. Authorization

Authorization is enforced by FastAPI.

The backend defines role-aware dependencies including:

- `get_current_user`
- `get_current_player`
- `get_current_web_user`
- `get_current_admin`

These dependencies determine whether an authenticated request has sufficient privileges for a protected endpoint.

Examples:

Player
  |
  v
get_current_player
  |
  v
Player-only endpoint

Educator / Web User
  |
  v
get_current_web_user
  |
  v
Web-portal endpoint

Admin
  |
  v
get_current_admin
  |
  v
Admin-only endpoint

The frontend must never be treated as the authoritative authorization layer.

## 9. Frontend Route Protection

Vue Router may use route guards to prevent unauthenticated or improperly assigned users from navigating to protected views.

Conceptually:

Unauthenticated user
    |
    v
Protected route
    |
    v
Redirect to authentication view

Authenticated Player
    |
    v
Player route

Authenticated Educator
    |
    v
Educator route

Authenticated Admin
    |
    v
Admin route

Route guards improve navigation control and user experience.

They do not replace backend authorization.

A user who bypasses the Vue interface can still send requests directly to the FastAPI API, therefore the backend must independently validate authentication and authorization.

## 10. Educator Approval Workflow

Educator registration includes an approval state.

Conceptually:

Educator
   |
   | Register
   v
Pending account
   |
   | Login attempt
   v
FastAPI
   |
   | account inactive
   v
403 Forbidden

Administrator
   |
   | Approve
   v
Account activated
   |
   | portal access granted
   v
Educator can authenticate

The backend provides administrative approval endpoints:

- `GET /admin/approvals`
- `POST /admin/approvals/{user_id}/approve`
- `POST /admin/approvals/{user_id}/reject`

Approval changes the user's activation and portal-access state according to the backend rules.

## 11. Logout

The frontend must clear its local authentication state when the user logs out.

At minimum, the frontend should remove the authentication state it manages and return the user to the authentication interface.

Whether the backend also requires a token revocation or server-side invalidation operation is not established in the backend plan.

Status:
TO BE VERIFIED.

## 12. Authentication Failure Handling

The frontend should distinguish between different classes of authentication failure.

### 401 Unauthorized

Typical meaning:
Authentication credentials are invalid or missing.

Example:
Invalid login credentials or invalid/tampered authentication token.

### 403 Forbidden

Typical meaning:
The request may be associated with an authenticated identity, but the user is not permitted to perform the requested operation.

Examples:

- Pending educator attempting to log in
- Player accessing an educator-only endpoint
- Educator accessing an admin-only endpoint

### 409 Conflict

Typical meaning:
The requested operation conflicts with the current resource state.

Example:
Attempting to register an already existing account.

The frontend should present appropriate user-facing messages rather than exposing raw backend errors.

## 13. Authentication Security Rules

The frontend must follow these rules:

1. Never hardcode passwords, JWT secrets, database credentials, or private API keys.
2. Never assume that frontend role checks provide actual security.
3. Never trust user-provided identity or role information without backend verification.
4. Do not expose sensitive authentication information in logs.
5. Do not invent authentication fields or token behavior.
6. Treat authentication responses as backend contracts.
7. Use HTTPS for deployed network communication.
8. Keep authentication-related configuration environment-driven where applicable.

## 14. Unknown / To Be Verified

The following implementation details require verification against the actual backend:

- Exact login request schema
- Exact login response schema
- JWT claims
- Token expiration duration
- Token storage strategy
- Refresh-token behavior, if any
- Logout/revocation behavior
- Godot-to-web authentication handoff
- Deep-link or custom URL behavior, if used
- Final production authentication domain