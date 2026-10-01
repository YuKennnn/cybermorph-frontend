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
  // Catch-all route for unrecognized paths
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    redirect: '/',
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next('/login')
  } else if ((to.path === '/login' || to.path === '/register') && authStore.isAuthenticated) {
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

export default router
