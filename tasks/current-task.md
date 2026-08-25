# Current Task: Classroom Feature

## Task
Implement the Classroom system, allowing educators to create, view, edit, and soft-delete classrooms, and view enrolled students, while allowing players to join classrooms using a 6-character access code. Supported by stateful in-memory mock endpoints in `src/api/mock.js` and role-aware navigation guards.

## Objective
Enable complete educator classroom management workflows and player classroom enrollment with role-based view separation.

## Scope

### In Scope
- Mock data endpoints in `src/api/mock.js`:
  - `POST /classroom/generate`
  - `GET /classroom/my-codes` and `GET /educator/classrooms`
  - `POST /classroom/join`
  - `GET /classroom/:id/students`
  - `PATCH /classroom/:id`
  - `DELETE /classroom/:id`
- Views:
  - `src/views/ClassroomManagementView.vue` (educator: list, create, edit, delete, view roster)
  - `src/views/ClassroomStudentsView.vue` (educator: roster table, map progress)
  - `src/views/ClassroomJoinView.vue` (player: join form, validation, error handling)
- Routing:
  - `src/router/index.js` (routes `/classroom/manage`, `/classroom/students/:code_id`, `/classroom/join` with `meta.roles` enforcement)
- Navigation:
  - `src/views/EducatorDashboard.vue` (link to `/classroom/manage`)
  - `src/views/PlayerDashboard.vue` (link to `/classroom/join`)

### Out of Scope
- Real backend integration
- Advanced analytics or gradebook features
- Classroom code expiration workflows
- Modifications to `src/api/client.js`

## Security & Architecture Rules
- Role verification must use `authStore.userRole`.
- Route guards check authentication and role (`meta.roles`).
- Unauthenticated requests redirect to `/login`; unauthorized role requests redirect to `/dashboard`.

## Verification Checklist
1. `npm run lint` passes with 0 errors and 0 warnings.
2. `npm run build` completes successfully.
3. Educator can generate a new classroom code and see it in `/classroom/manage`.
4. Educator can edit and soft-delete classrooms.
5. Educator can view student rosters in `/classroom/students/:id`.
6. Player can join a classroom via `/classroom/join` with code validation.
7. Role guards prevent cross-role access between educator and player views.