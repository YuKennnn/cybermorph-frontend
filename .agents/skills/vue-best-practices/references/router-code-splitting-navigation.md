# Vue Router Code Splitting & Navigation Architecture

## Architecture Overview

In CyberMorph, Vue Router manages client-side routing, code splitting, and UX navigation guards across public, player, educator, and administrative views.

### 1. Dynamic Route-Level Code Splitting
All route components must be loaded via dynamic import expressions (`() => import(...)`). Vite chunks each view into a separate JavaScript bundle requested only when the user visits that route, preserving initial load speed:

```javascript
// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/authStore'

const routes = [
  {
    path: '/',
    name: 'landing',
    component: () => import('../views/LandingView.vue'),
    meta: { isPublic: true },
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('../views/DashboardView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/classroom/manage',
    name: 'classroom-manage',
    component: () => import('../views/ClassroomManagementView.vue'),
    meta: { requiresAuth: true, roles: ['educator'] },
  },
  {
    path: '/admin/users',
    name: 'admin-users',
    component: () => import('../views/AdminUsersView.vue'),
    meta: { requiresAuth: true, roles: ['admin'] },
  },
  // Catch-all route for unrecognized paths
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    redirect: '/',
  },
]
```

### 2. Client-Side Guards as UX, Not Security Boundaries
As defined in `docs/security.md` and `AGENTS.md`:
- Navigation guards prevent accidental navigation by redirecting unauthenticated users to `/login` and role-restricted views to `/dashboard`.
- **They must never be treated as the security boundary.**
- All sensitive operations and queries must be enforced by FastAPI backend dependencies (`get_current_player`, `get_current_web_user`, `get_current_admin`).

```javascript
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next('/login')
  } else if ((to.path === '/' || to.path === '/login' || to.path === '/register') && authStore.isAuthenticated) {
    next('/dashboard')
  } else if (
    to.meta.roles &&
    to.meta.roles.length > 0 &&
    (!authStore.userRole || !to.meta.roles.includes(authStore.userRole))
  ) {
    next('/dashboard')
  } else {
    next()
  }
})
```

---

## Verification Steps
1. Verify with non-fixing linting:
   ```powershell
   npx oxlint .
   npx eslint .
   ```
2. Build the project with `npm run build` and observe that Vite outputs distinct asset chunks for route components.
3. Verify that accessing a non-existent route redirects cleanly via the catch-all rule.
