# Current Task: Authentication UI + Mock Backend

## Task
Build the authentication UI, update `authStore.js` to align with the documented `/auth/` backend endpoints, implement a development-only mock backend using `axios-mock-adapter`, and set up client-side routes with navigation guards.

## Objective
Enable complete frontend authentication workflows (login, registration for player and educator roles, logout, route protection) against a simulated backend in development without connecting to the production database or assuming undocumented API behaviors.

## Scope

### In Scope
- Development dependency: `axios-mock-adapter`
- Development mock backend: `src/api/mock.js` (gated by `import.meta.env.DEV`)
- Simulated endpoints:
  - `POST /auth/login`
  - `POST /auth/register`
  - `POST /auth/register-web`
- Store updates: `src/stores/authStore.js` (`login`, `logout`, `registerPlayer`, `registerWeb`)
- Views:
  - `src/views/LoginView.vue`
  - `src/views/RegisterView.vue`
  - `src/views/DashboardView.vue` (placeholder)
- Routing: `src/router/index.js` (routes `/`, `/login`, `/register`, `/dashboard` and `beforeEach` navigation guards)
- App layout: `src/App.vue` hosting `<RouterView />`

### Out of Scope
- Real backend integration
- Token refresh or server-side token revocation
- Detailed educator/admin analytics dashboards (placeholder dashboard only)
- Modifications to `src/api/client.js`

## Security Requirements
- Do not store credentials or secrets in source code.
- Route guards are client-side UX only; FastAPI backend remains authoritative for authorization.
- The mock adapter must be excluded from production execution.

## Verification
1. Run `npm run lint` (0 errors/warnings).
2. Run `npm run build` (successful compilation).
3. Test login, registration (player & educator), logout, and protected route redirection in development.