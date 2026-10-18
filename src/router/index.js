import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/authStore'
import { isReducedMotionActive } from '../utils/accessibility.js'
import { stopNarration } from '../utils/speech.js'

const routes = [
  {
    path: '/',
    name: 'landing',
    component: () => import('../views/LandingView.vue'),
    meta: { isPublic: true },
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('../views/AboutView.vue'),
    meta: { isPublic: true },
  },
  {
    path: '/gameplay',
    name: 'gameplay',
    component: () => import('../views/GameplayView.vue'),
    meta: { isPublic: true },
  },
  {
    path: '/download',
    name: 'download',
    component: () => import('../views/DownloadView.vue'),
    meta: { isPublic: true },
  },
  {
    path: '/faq',
    name: 'faq',
    component: () => import('../views/FaqView.vue'),
    meta: { isPublic: true },
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
    meta: { isPublic: true },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('../views/RegisterView.vue'),
    meta: { isPublic: true },
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('../views/DashboardView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../views/SettingsView.vue'),
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
    path: '/classroom/students/:code_id/progress/:profile_id',
    name: 'student-progress',
    component: () => import('../views/StudentProgressView.vue'),
    meta: { requiresAuth: true, roles: ['educator'] },
  },
  {
    path: '/classroom/settings/:code_id',
    name: 'classroom-settings',
    component: () => import('../views/ClassroomSettingsView.vue'),
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
  {
    path: '/admin/users',
    name: 'admin-users',
    component: () => import('../views/AdminUsersView.vue'),
    meta: { requiresAuth: true, roles: ['admin'] },
  },
  {
    path: '/admin/approvals',
    name: 'admin-approvals',
    component: () => import('../views/AdminApprovalsView.vue'),
    meta: { requiresAuth: true, roles: ['admin'] },
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
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    }
    const behavior = isReducedMotionActive() ? 'auto' : 'smooth'
    if (to.hash) {
      return { el: to.hash, behavior }
    }
    return { top: 0, behavior }
  },
})

router.beforeEach((to, from, next) => {
  if (to.path === '/download' && to.hash === '#faq') {
    next({ path: '/faq', replace: true })
    return
  }

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

router.afterEach((to, from, failure) => {
  // Only stop narration on successful, non-failed page navigation where destination path changed
  if (!failure && to.path !== from.path) {
    stopNarration()
  }
})

export default router
