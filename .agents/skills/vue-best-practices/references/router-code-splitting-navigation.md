# Vue Router Code Splitting & Navigation Architecture

## Context & Problem Statement

In `src/router/index.js`, all route components are currently loaded via static eager imports:

```javascript
// src/router/index.js (Current implementation)
import LandingView from '../views/LandingView.vue'
import LoginView from '../views/LoginView.vue'
import RegisterView from '../views/RegisterView.vue'
import DashboardView from '../views/DashboardView.vue'
import LeaderboardView from '../views/LeaderboardView.vue'
import ClassroomManagementView from '../views/ClassroomManagementView.vue'
import ClassroomStudentsView from '../views/ClassroomStudentsView.vue'
import ClassroomJoinView from '../views/ClassroomJoinView.vue'
import EducatorAnalyticsView from '../views/EducatorAnalyticsView.vue'
```

### Issues Identified
1. **Monolithic Bundle (No Code Splitting)**:
   - When a student or visitor accesses the landing page (`/`), Vite is forced to bundle all 9 views (including the massive 1,686-line `EducatorAnalyticsView` and the administrative views) into the initial JavaScript chunk.
   - This degrades Initial Server Response and First Contentful Paint (FCP) on slow educational network uplinks.
2. **Missing 404 Catch-All Route**:
   - Navigating to an invalid route (e.g. `/classrooms` instead of `/classroom/manage` or mistyped `/dash`) results in a blank content area without helpful feedback or automatic redirection.
3. **Missing Explicit Admin Route**:
   - `AdminDashboard.vue` has no direct route entry (`/admin`) and is only reachable conditionally as an inner component in `DashboardView.vue`.
   - Direct linking, bookmarks, and explicit route guards for administrators cannot be utilized.

---

## Recommended Architecture

### 1. Dynamic Route-Level Code Splitting
Utilize dynamic import expressions (`() => import(...)`) so Vite automatically chunks views into separate, on-demand bundles:

```javascript
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/authStore'

const routes = [
  {
    path: '/',
    name: 'landing',
    component: () => import('../views/LandingView.vue'),
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('../views/RegisterView.vue'),
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('../views/DashboardView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/admin',
    name: 'admin-dashboard',
    component: () => import('../views/AdminDashboard.vue'),
    meta: { requiresAuth: true, roles: ['admin'] },
  },
  {
    path: '/leaderboard',
    name: 'leaderboard',
    component: () => import('../views/LeaderboardView.vue'),
  },
  {
    path: '/classroom/manage',
    name: 'classroom-manage',
    component: () => import('../views/ClassroomManagementView.vue'),
    meta: { requiresAuth: true, roles: ['educator'] },
  },
  {
    path: '/classroom/students/:code_id',
    name: 'classroom-students',
    component: () => import('../views/ClassroomStudentsView.vue'),
    meta: { requiresAuth: true, roles: ['educator'] },
  },
  {
    path: '/classroom/join',
    name: 'classroom-join',
    component: () => import('../views/ClassroomJoinView.vue'),
    meta: { requiresAuth: true, roles: ['player'] },
  },
  {
    path: '/analytics/:code_id?',
    name: 'educator-analytics',
    component: () => import('../views/EducatorAnalyticsView.vue'),
    meta: { requiresAuth: true, roles: ['educator'] },
  },
  // 404 Catch-All Wildcard Route
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    redirect: '/',
  },
]
```

### 2. Client-Side Guards as UX, Not Security Boundaries
As defined in `docs/security.md` and `AGENTS.md`:
- Client-side navigation guards provide convenience by redirecting unauthenticated users to `/login` and role-restricted views to `/dashboard`.
- They **must never be treated as the security boundary**.
- All data operations must continue to be enforced by the FastAPI backend dependencies (`get_current_player`, `get_current_web_user`, `get_current_admin`).

---

## Verification Steps
1. Run `npm run build` and observe the terminal output. Notice how Vite outputs individual asset chunks:
   - `dist/assets/EducatorAnalyticsView-[hash].js`
   - `dist/assets/LandingView-[hash].js`
2. Open Network tab in browser DevTools:
   - Navigate to `/` and verify only the landing bundle loads.
   - Click "Leaderboard" and verify the leaderboard bundle loads dynamically.
3. Type an unrecognized URL (e.g. `http://localhost:5173/nonexistent-route`) and verify it cleanly redirects or displays a friendly 404 screen.
