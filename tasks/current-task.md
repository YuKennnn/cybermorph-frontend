# Current Task: Role-Based Dashboards

## Task
Build role-specific dashboard views (`PlayerDashboard.vue`, `EducatorDashboard.vue`, `AdminDashboard.vue`), refactor `DashboardView.vue` as a dynamic container rendering the appropriate view according to `authStore.userRole`, and extend the mock backend (`src/api/mock.js`) with sample dashboard data endpoints.

## Objective
Provide a tailored web portal experience for each of the three CyberMorph user roles (`player`, `educator`, `admin`) with relevant metrics, actions, and simulated backend responses.

## Scope

### In Scope
- Mock data endpoints in `src/api/mock.js`:
  - `GET /players/me`
  - `GET /educator/classrooms` (and `GET /classroom/my-codes`)
  - `GET /admin/stats`
- Role components:
  - `src/views/PlayerDashboard.vue` (stats: games played, best score, Threat Index progress, "Play Game" placeholder)
  - `src/views/EducatorDashboard.vue` (overview: classrooms count, enrolled students, recent activity, "Create Classroom" placeholder)
  - `src/views/AdminDashboard.vue` (stats: total users, active sessions, pending approvals, admin panel quick links)
- Container component:
  - `src/views/DashboardView.vue` (renders role view based on `authStore.userRole`, shared header and logout action)

### Out of Scope
- Real backend integration
- Live Godot mobile game integration
- Full classroom creation/student management CRUD forms
- Full admin approval management CRUD views
- Modifying `src/api/client.js` or authentication logic

## Security & Architecture Rules
- Role determination must be read from `authStore.userRole`, not URL parameters.
- Client-side dashboard routing remains a UX organization layer; actual authorization boundaries are enforced by the FastAPI backend.
- Mock backend code remains restricted to development mode (`import.meta.env.DEV`).

## Verification Checklist
1. `npm run lint` passes with 0 errors and 0 warnings.
2. `npm run build` completes successfully.
3. Logging in as player renders `PlayerDashboard`.
4. Logging in as educator renders `EducatorDashboard`.
5. Logging in as admin renders `AdminDashboard`.
6. Logout works cleanly from all role dashboards.