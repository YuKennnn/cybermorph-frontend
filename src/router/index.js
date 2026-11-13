import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/authStore'
import { usePlayerClassroomStore } from '../stores/playerClassroomStore'
import { isReducedMotionActive } from '../utils/accessibility.js'
import { stopNarration } from '../utils/speech.js'

const routes = [
  {
    path: '/',
    name: 'landing',
    component: () => import('../views/LandingView.vue'),
    meta: { isPublic: true, guestOnly: true },
  },
  {
    path: '/home',
    redirect: { name: 'landing' },
    meta: { isPublic: true, guestOnly: true },
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('../views/AboutView.vue'),
    meta: { isPublic: true, guestOnly: true },
  },
  {
    path: '/gameplay',
    name: 'gameplay',
    component: () => import('../views/GameplayView.vue'),
    meta: { isPublic: true, guestOnly: true },
  },
  {
    path: '/download',
    name: 'download',
    component: () => import('../views/DownloadView.vue'),
    meta: { isPublic: true, guestOnly: true },
  },
  {
    path: '/faq',
    name: 'faq',
    component: () => import('../views/FaqView.vue'),
    meta: { isPublic: true, guestOnly: true },
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
    meta: { isPublic: true, guestOnly: true },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('../views/RegisterView.vue'),
    meta: { isPublic: true, guestOnly: true },
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
    redirect: (to) => {
      const nextQuery = { ...to.query }
      const rawPage = Array.isArray(nextQuery.page) ? nextQuery.page[0] : nextQuery.page
      const parsedPage = Number.parseInt(String(rawPage ?? ''), 10)
      delete nextQuery.page
      if (Number.isFinite(parsedPage) && parsedPage > 1) {
        nextQuery.table_page = String(parsedPage)
      } else if (parsedPage === 1) {
        delete nextQuery.table_page
      }
      return {
        name: 'educator-analytics',
        params: { code_id: to.params.code_id },
        query: nextQuery,
        hash: '#students-roster',
      }
    },
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
    path: '/classroom',
    name: 'player-classroom',
    component: () => import('../views/PlayerClassroomView.vue'),
    meta: { requiresAuth: true, roles: ['player'] },
  },
  {
    path: '/classroom/join',
    name: 'classroom-join',
    component: () => import('../views/ClassroomJoinView.vue'),
    meta: { requiresAuth: true, roles: ['player'] },
  },
  {
    path: '/threat-index',
    name: 'threat-index',
    component: () => import('../views/ThreatIndexView.vue'),
    meta: { requiresAuth: true, roles: ['player'] },
  },
  {
    path: '/threat-index/:slug',
    name: 'threat-lesson',
    component: () => import('../views/ThreatLessonView.vue'),
    meta: { requiresAuth: true, roles: ['player'] },
  },
  {
    path: '/post-test',
    name: 'post-test',
    component: () => import('../views/PostTestView.vue'),
    meta: { requiresAuth: true, roles: ['player'] },
  },
  {
    path: '/session-history',
    name: 'session-history',
    component: () => import('../views/SessionHistoryView.vue'),
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
  {
    path: '/admin/classrooms',
    name: 'admin-classrooms',
    component: () => import('../views/AdminClassroomsView.vue'),
    meta: { requiresAuth: true, roles: ['admin'] },
  },
  {
    path: '/admin/logs',
    name: 'admin-logs',
    component: () => import('../views/AdminLogsView.vue'),
    meta: { requiresAuth: true, roles: ['admin'] },
  },
  {
    path: '/admin/play-data',
    name: 'admin-play-data',
    component: () => import('../views/AdminPlayDataView.vue'),
    meta: { requiresAuth: true, roles: ['admin'] },
  },
  {
    path: '/admin/post-test-results',
    name: 'admin-post-test-results',
    component: () => import('../views/AdminPostTestResultsView.vue'),
    meta: { requiresAuth: true, roles: ['admin'] },
  },
  // Catch-all route for unrecognized paths
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('../views/NotFoundView.vue'),
    meta: { isPublic: true },
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
    if (to.hash && (to.path !== from.path || to.hash !== from.hash)) {
      return { el: to.hash, behavior }
    }
    if (to.path === from.path) {
      return false
    }
    return { top: 0, behavior }
  },
})

router.beforeEach((to) => {
  const authStore = useAuthStore()

  // 1. Signed-in user attempting to access a guest-only route redirects to role dashboard
  // Returning a route path performs push navigation and preserves Back history
  if (to.meta?.guestOnly && authStore.isAuthenticated) {
    return '/dashboard'
  }

  // 2. Legacy download FAQ hash redirect for guest visitors
  if (to.name === 'download' && to.hash === '#faq') {
    return { path: '/faq', replace: true }
  }

  // 3. Unauthenticated access to protected routes
  if (to.meta?.requiresAuth && !authStore.isAuthenticated) {
    if (to.path === '/post-test') {
      return { path: '/login', query: { next: '/post-test' } }
    }
    return '/login'
  }

  // 4. Role-based route guard
  if (
    to.meta?.roles &&
    to.meta.roles.length > 0 &&
    (!authStore.userRole || !to.meta.roles.includes(authStore.userRole))
  ) {
    if (to.path === '/post-test' && (authStore.isEducator || authStore.isAdmin)) {
      authStore.setDashboardNotice('The post-test is for players')
    }
    return '/dashboard'
  }

  // 5. Player classroom scope sync and redirect
  if (
    authStore.isPlayer &&
    (to.path === '/classroom' || to.path === '/classroom/join')
  ) {
    const playerClassroomStore = usePlayerClassroomStore()
    playerClassroomStore.syncAccountScope()
    const redirectTarget = playerClassroomStore.resolveRedirectForPath(to.path)
    if (redirectTarget && redirectTarget !== to.path) {
      return { path: redirectTarget, replace: true }
    }
  }

  return true
})

router.afterEach((to, from, failure) => {
  // Only stop narration on successful, non-failed page navigation where destination path changed
  if (!failure && to.path !== from.path) {
    stopNarration()
  }
})

export default router
