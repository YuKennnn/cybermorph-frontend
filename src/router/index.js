import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/authStore'
import LandingView from '../views/LandingView.vue'
import LoginView from '../views/LoginView.vue'
import RegisterView from '../views/RegisterView.vue'
import DashboardView from '../views/DashboardView.vue'
import LeaderboardView from '../views/LeaderboardView.vue'
import ClassroomManagementView from '../views/ClassroomManagementView.vue'
import ClassroomStudentsView from '../views/ClassroomStudentsView.vue'
import ClassroomJoinView from '../views/ClassroomJoinView.vue'
import EducatorAnalyticsView from '../views/EducatorAnalyticsView.vue'

const routes = [
  {
    path: '/',
    name: 'landing',
    component: LandingView,
  },
  {
    path: '/login',
    name: 'login',
    component: LoginView,
  },
  {
    path: '/register',
    name: 'register',
    component: RegisterView,
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: DashboardView,
    meta: { requiresAuth: true },
  },
  {
    path: '/leaderboard',
    name: 'leaderboard',
    component: LeaderboardView,
  },
  {
    path: '/classroom/manage',
    name: 'classroom-manage',
    component: ClassroomManagementView,
    meta: { requiresAuth: true, roles: ['educator'] },
  },
  {
    path: '/classroom/students/:code_id',
    name: 'classroom-students',
    component: ClassroomStudentsView,
    meta: { requiresAuth: true, roles: ['educator'] },
  },
  {
    path: '/classroom/join',
    name: 'classroom-join',
    component: ClassroomJoinView,
    meta: { requiresAuth: true, roles: ['player'] },
  },
  {
    path: '/analytics/:code_id?',
    name: 'educator-analytics',
    component: EducatorAnalyticsView,
    meta: { requiresAuth: true, roles: ['educator'] },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  const isAuthenticated = !!authStore.token

  if (to.meta.requiresAuth && !isAuthenticated) {
    next('/login')
  } else if ((to.path === '/login' || to.path === '/register') && isAuthenticated) {
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
