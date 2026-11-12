<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchClassroomStudents } from '../api/classroom.js'
import { fetchClassroomAnalytics, fetchPlayerAnalytics } from '../api/analytics.js'
import { useClassroomStore } from '../stores/classroomStore.js'
import { useAuthStore } from '../stores/authStore.js'
import { useApiCacheStore } from '../stores/apiCacheStore.js'
import { classifyApiError } from '../api/client.js'
import { CANONICAL_THREAT_CATEGORIES } from '../stores/threatIndexStore.js'
import { classifyCategoryBreakdown } from '../utils/analyticsValidation.js'
import { formatLastSyncedDate, formatThreatUnlockedCount } from '../utils/datetime.js'
import AppIcon from '../components/common/AppIcon.vue'
import ClassroomWorkspaceHeader from '../components/classroom/ClassroomWorkspaceHeader.vue'
import ThreatPerformanceGauge from '../components/analytics/ThreatPerformanceGauge.vue'
import StudentProgressModal from '../components/analytics/StudentProgressModal.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const classroomStore = useClassroomStore()
const cacheStore = useApiCacheStore()
const AGGREGATE_TTL = 120000 // 120s
const ROSTER_TTL = 60000 // 60s
const STUDENT_ANALYTICS_TTL = 60000 // 60s

// Reused Canonical DICT Threat Categories
const CANONICAL_THREATS = CANONICAL_THREAT_CATEGORIES

// Canonical Simulation Maps
const CANONICAL_MAPS = [
  { name: 'Home' },
  { name: 'Office' },
  { name: 'Internet Cafe' },
  { name: 'Public Park' },
]

// Concurrency & stale response request ID guards
let classroomRequestId = 0
let rosterRequestId = 0
let bareRouteSeq = 0
let modalAnalyticsRequestId = 0
let modalIdentityRequestId = 0
let isComponentMounted = true

const rosterSectionRef = ref(null)

const isCurrentBareAnalyticsContext = (seq) => {
  return (
    seq === bareRouteSeq &&
    isComponentMounted &&
    !route.params.code_id &&
    route.path === '/analytics'
  )
}

// ==========================================
// Level 1: Classroom Aggregate State
// ==========================================
const classroomAnalytics = ref(null)
const students = ref([])
const isAnalyticsLoading = ref(false)
const isStudentsLoading = ref(false)
const aggregateErrorMessage = ref('')
const rosterErrorMessage = ref('')
const hasConfirmedRoster = ref(false)

// Table Pagination
const parseQueryInt = (val, fallback = 1) => {
  const normalized = Array.isArray(val) ? val[0] : val
  const p = Number.parseInt(String(normalized ?? ''), 10)
  return Number.isFinite(p) && p > 0 ? p : fallback
}

const tablePage = ref(parseQueryInt(route.query.table_page, 1))
const tablePageSize = ref(10)
const tableTotalCount = ref(0)

const tableTotalPages = computed(() => {
  if (tableTotalCount.value <= 0) return 1
  return Math.ceil(tableTotalCount.value / tablePageSize.value)
})

// Current Classroom Context
const effectiveCodeId = computed(() => {
  return route.params.code_id ? String(route.params.code_id) : ''
})

// Level 3: Student Progress Modal State (synced with ?student=<profile_id>)
const modalOpenedFromRoster = ref(false)
const modalAnalytics = ref(null)
const modalIdentity = ref(null)
const isModalAnalyticsLoading = ref(false)
const isModalIdentityLoading = ref(false)
const modalErrorMessage = ref('')

const activeModalStudentId = computed(() => {
  const raw = Array.isArray(route.query.student) ? route.query.student[0] : route.query.student
  return typeof raw === 'string' && raw.trim() ? raw.trim() : ''
})

const isStudentModalOpen = computed(() => {
  return Boolean(effectiveCodeId.value && activeModalStudentId.value)
})

const modalFullProgressRoute = computed(() => {
  if (!effectiveCodeId.value || !activeModalStudentId.value) return null
  const query = { origin: 'analytics' }
  if (tablePage.value > 1) {
    query.table_page = tablePage.value
  }
  return {
    path: `/classroom/students/${effectiveCodeId.value}/progress/${activeModalStudentId.value}`,
    query,
  }
})

// Documented matching: use only code_id. Never use id, code_value, or code as aliases.
const currentClassroom = computed(() => {
  if (!effectiveCodeId.value) return null
  return (
    classroomStore.classrooms.find(
      (c) => String(c.code_id) === String(effectiveCodeId.value),
    ) || null
  )
})

// ==========================================
// Data Fetching Operations
// ==========================================
const loadAggregateAnalytics = async (codeId, force = false) => {
  const reqId = ++classroomRequestId
  const reqAuthEpoch = authStore.activeSessionEpoch
  const targetCodeId = String(codeId || '')

  if (!targetCodeId || !authStore.isAuthenticated || !authStore.isEducator) {
    isAnalyticsLoading.value = false
    return
  }

  const isCurrentAggregateReq = () =>
    isComponentMounted &&
    reqId === classroomRequestId &&
    authStore.isAuthenticated &&
    authStore.isEducator &&
    authStore.activeSessionEpoch === reqAuthEpoch &&
    effectiveCodeId.value === targetCodeId

  const cacheKey = `educator::analytics::classroom::code_id=${targetCodeId}`
  const reqKeyVersion = cacheStore.getKeyVersion(cacheKey)

  if (!force) {
    const cached = cacheStore.get(cacheKey)
    if (cached && !cached.isExpired) {
      if (!isCurrentAggregateReq()) return
      classroomAnalytics.value = cached.data
      isAnalyticsLoading.value = false
      aggregateErrorMessage.value = ''
      return
    }
  }

  isAnalyticsLoading.value = true
  aggregateErrorMessage.value = ''

  try {
    const data = await fetchClassroomAnalytics(targetCodeId)
    if (!isCurrentAggregateReq()) return
    if (cacheStore.getKeyVersion(cacheKey) === reqKeyVersion) {
      cacheStore.set(cacheKey, data, AGGREGATE_TTL)
    }
    classroomAnalytics.value = data
  } catch (err) {
    if (!isCurrentAggregateReq()) return
    const status = err?.response?.status
    const errType = classifyApiError(err)

    classroomAnalytics.value = null
    if (status === 403 || status === 404) {
      cacheStore.invalidateKey(cacheKey)
      cacheStore.invalidatePrefix(`educator::roster::page::code_id=${targetCodeId}`)
    }

    if (status === 403) {
      aggregateErrorMessage.value = 'You do not have permission to view analytics for this classroom.'
    } else if (status === 404) {
      aggregateErrorMessage.value = 'Classroom not found or no longer exists.'
    } else if (errType === 'timeout') {
      aggregateErrorMessage.value = 'Request timed out while loading classroom summary.'
    } else {
      aggregateErrorMessage.value = 'Could not load classroom summary.'
    }
  } finally {
    if (
      isComponentMounted &&
      reqId === classroomRequestId &&
      authStore.activeSessionEpoch === reqAuthEpoch
    ) {
      isAnalyticsLoading.value = false
    }
  }
}

const applyStudentRosterPayload = (r, targetPage) => {
  if (Array.isArray(r)) {
    students.value = r
    tableTotalCount.value = r.length
    tablePage.value = 1
    hasConfirmedRoster.value = true
  } else if (r && typeof r === 'object') {
    students.value = r.items || r.students || []
    tableTotalCount.value = r.total_count ?? r.total ?? students.value.length
    tablePage.value = r.page ?? targetPage
    tablePageSize.value = r.page_size ?? tablePageSize.value
    hasConfirmedRoster.value = true
  } else {
    students.value = []
    tableTotalCount.value = 0
    hasConfirmedRoster.value = true
  }
}

const loadStudentRoster = async (codeId, targetPage = tablePage.value, force = false) => {
  const reqId = ++rosterRequestId
  const reqAuthEpoch = authStore.activeSessionEpoch
  const targetCodeId = String(codeId || '')

  if (!targetCodeId || !authStore.isAuthenticated || !authStore.isEducator) {
    isStudentsLoading.value = false
    return
  }

  const isCurrentRosterReq = () =>
    isComponentMounted &&
    reqId === rosterRequestId &&
    authStore.isAuthenticated &&
    authStore.isEducator &&
    authStore.activeSessionEpoch === reqAuthEpoch &&
    effectiveCodeId.value === targetCodeId

  const cacheKey = `educator::roster::page::code_id=${targetCodeId}&page=${targetPage}&page_size=${tablePageSize.value}`
  const reqKeyVersion = cacheStore.getKeyVersion(cacheKey)

  if (!force) {
    const cached = cacheStore.get(cacheKey)
    if (cached && !cached.isExpired) {
      if (!isCurrentRosterReq()) return
      applyStudentRosterPayload(cached.data, targetPage)
      isStudentsLoading.value = false
      rosterErrorMessage.value = ''
      return
    }
  }

  isStudentsLoading.value = true
  rosterErrorMessage.value = ''

  try {
    const r = await fetchClassroomStudents(targetCodeId, {
      page: targetPage,
      page_size: tablePageSize.value,
    })
    if (!isCurrentRosterReq()) return

    applyStudentRosterPayload(r, targetPage)
    if (cacheStore.getKeyVersion(cacheKey) === reqKeyVersion) {
      cacheStore.set(cacheKey, r, ROSTER_TTL)
    }
  } catch (err) {
    if (!isCurrentRosterReq()) return
    const status = err?.response?.status
    const errType = classifyApiError(err)

    students.value = []
    tableTotalCount.value = 0
    hasConfirmedRoster.value = false
    if (status === 403 || status === 404) {
      cacheStore.invalidatePrefix(`educator::roster::page::code_id=${targetCodeId}`)
      cacheStore.invalidateKey(`educator::analytics::classroom::code_id=${targetCodeId}`)
    }

    if (status === 403) {
      rosterErrorMessage.value = 'You do not have permission to view this classroom roster.'
    } else if (status === 404) {
      rosterErrorMessage.value = 'Classroom not found or no longer exists.'
    } else if (errType === 'timeout') {
      rosterErrorMessage.value = 'Request timed out while loading student roster.'
    } else {
      rosterErrorMessage.value = 'Could not load student roster.'
    }
  } finally {
    if (
      isComponentMounted &&
      reqId === rosterRequestId &&
      authStore.activeSessionEpoch === reqAuthEpoch
    ) {
      isStudentsLoading.value = false
    }
  }
}

const loadClassroomData = (codeId, targetPage = tablePage.value, force = false) => {
  return Promise.allSettled([
    loadAggregateAnalytics(codeId, force),
    loadStudentRoster(codeId, targetPage, force),
  ])
}

// ==========================================
// Bare /analytics Redirection Handling
// ==========================================
const resolveBareAnalyticsRoute = async () => {
  const currentSeq = ++bareRouteSeq

  if (route.params.code_id) {
    classroomStore.setCurrentClassroomId(route.params.code_id)
    if (!classroomStore.isFetched && !classroomStore.isLoading) {
      classroomStore.fetchClassrooms().catch(() => {})
    }
    return
  }

  // Bare /analytics route: ensure classroom list is fetched
  if (!classroomStore.isFetched) {
    try {
      await classroomStore.fetchClassrooms()
    } catch {
      // List loading failed. classroomStore.error is set.
      // Distinguish list-loading failure from empty list.
      return
    }
  }

  // Guard against obsolete navigation:
  // After awaiting classroom loading, redirect only if this operation
  // is still current and the user is still on bare /analytics.
  if (!isCurrentBareAnalyticsContext(currentSeq)) {
    return
  }

  // Confirmed empty classrooms list
  if (classroomStore.classrooms.length === 0) {
    return
  }

  // Prefer valid classroom already selected in the shared store; otherwise choose the first available classroom
  const selectedId = classroomStore.currentClassroomId
  const hasValidSelection =
    selectedId &&
    classroomStore.classrooms.some((c) => String(c.code_id) === String(selectedId))

  const targetId = hasValidSelection
    ? String(selectedId)
    : String(classroomStore.classrooms[0].code_id)

  classroomStore.setCurrentClassroomId(targetId)

  // Verify context again before replacing route
  if (!isCurrentBareAnalyticsContext(currentSeq)) {
    return
  }

  // Preserve relevant query parameters during redirection
  router.replace({
    path: `/analytics/${targetId}`,
    query: { ...route.query },
  })
}

const retryClassroomList = async () => {
  const currentSeq = ++bareRouteSeq
  try {
    await classroomStore.fetchClassrooms(true)
    if (isCurrentBareAnalyticsContext(currentSeq)) {
      resolveBareAnalyticsRoute()
    }
  } catch {
    // Error is captured in classroomStore.error
  }
}

// ==========================================
// Metadata Retry (Condition 1)
// ==========================================
const handleRetryMetadata = () => {
  // ClassroomWorkspaceHeader already executed classroomStore.fetchClassrooms(true).
  // Do NOT trigger another fetchClassrooms call here.
  // Retry failed analytics or roster requests separately if they were in an error state.
  if (aggregateErrorMessage.value) {
    loadAggregateAnalytics(effectiveCodeId.value, true)
  }
  if (rosterErrorMessage.value) {
    loadStudentRoster(effectiveCodeId.value, tablePage.value)
  }
}

// ==========================================
// Student Modal & Roster Navigation
// ==========================================
const prefersReducedMotion = () => {
  if (
    typeof document !== 'undefined' &&
    document.documentElement?.dataset?.reducedMotion === 'true'
  ) {
    return true
  }
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

const jumpToStudents = () => {
  const behavior = prefersReducedMotion() ? 'auto' : 'smooth'
  rosterSectionRef.value?.scrollIntoView?.({ behavior, block: 'start' })
}

const resetModalState = () => {
  modalAnalyticsRequestId++
  modalIdentityRequestId++
  modalOpenedFromRoster.value = false
  modalAnalytics.value = null
  modalIdentity.value = null
  isModalAnalyticsLoading.value = false
  isModalIdentityLoading.value = false
  modalErrorMessage.value = ''
}

const loadModalStudentAnalytics = async (profileId, force = false) => {
  const reqId = ++modalAnalyticsRequestId
  const reqAuthEpoch = authStore.activeSessionEpoch
  const targetCodeId = effectiveCodeId.value
  const targetProfileId = String(profileId || '').trim()

  if (!targetCodeId || !targetProfileId || !authStore.isAuthenticated || !authStore.isEducator) {
    isModalAnalyticsLoading.value = false
    return
  }

  const isCurrentModalAnalyticsReq = () =>
    isComponentMounted &&
    reqId === modalAnalyticsRequestId &&
    authStore.isAuthenticated &&
    authStore.isEducator &&
    authStore.activeSessionEpoch === reqAuthEpoch &&
    effectiveCodeId.value === targetCodeId &&
    activeModalStudentId.value === targetProfileId

  const cacheKey = `educator::analytics::student::profile_id=${targetProfileId}`
  const reqKeyVersion = cacheStore.getKeyVersion(cacheKey)

  if (!force) {
    const cached = cacheStore.get(cacheKey)
    if (cached && !cached.isExpired) {
      if (!isCurrentModalAnalyticsReq()) return
      modalAnalytics.value = cached.data
      modalErrorMessage.value = ''
      isModalAnalyticsLoading.value = false
      return
    }
  }

  isModalAnalyticsLoading.value = true
  modalErrorMessage.value = ''
  modalAnalytics.value = null

  try {
    const data = await fetchPlayerAnalytics(targetProfileId)
    if (!isCurrentModalAnalyticsReq()) return
    modalAnalytics.value = data
    if (cacheStore.getKeyVersion(cacheKey) === reqKeyVersion) {
      cacheStore.set(cacheKey, data, STUDENT_ANALYTICS_TTL)
    }
  } catch (err) {
    if (!isCurrentModalAnalyticsReq()) return
    const status = err?.response?.status
    const errType = classifyApiError(err)

    modalAnalytics.value = null
    if (status === 403 || status === 404) {
      cacheStore.invalidateKey(cacheKey)
    }

    if (status === 403) {
      modalErrorMessage.value = 'You do not have permission to view this student progress report.'
    } else if (status === 404) {
      modalErrorMessage.value = 'Student progress could not be found.'
    } else if (errType === 'timeout') {
      modalErrorMessage.value = 'Request timed out while loading student progress.'
    } else {
      modalErrorMessage.value = 'Could not load student progress right now.'
    }
  } finally {
    if (
      isComponentMounted &&
      reqId === modalAnalyticsRequestId &&
      authStore.activeSessionEpoch === reqAuthEpoch
    ) {
      isModalAnalyticsLoading.value = false
    }
  }
}

const resolveModalStudentIdentity = async (codeId, profileId) => {
  const reqId = ++modalIdentityRequestId
  const reqAuthEpoch = authStore.activeSessionEpoch
  const targetCodeId = String(codeId || '')
  const targetProfileId = String(profileId || '').trim()

  if (!targetCodeId || !targetProfileId || !authStore.isAuthenticated || !authStore.isEducator) {
    isModalIdentityLoading.value = false
    return
  }

  const isCurrentIdentityReq = () =>
    isComponentMounted &&
    reqId === modalIdentityRequestId &&
    authStore.isAuthenticated &&
    authStore.isEducator &&
    authStore.activeSessionEpoch === reqAuthEpoch &&
    effectiveCodeId.value === targetCodeId &&
    activeModalStudentId.value === targetProfileId

  const localMatch = students.value.find((s) => String(s.profile_id) === targetProfileId)
  if (localMatch) {
    modalIdentity.value = localMatch
    isModalIdentityLoading.value = false
    return
  }

  isModalIdentityLoading.value = true

  const candidatePages = []
  const seen = new Set()
  const maxPages = 5
  const startPage = Math.min(Math.max(1, tablePage.value), maxPages)
  for (const p of [startPage, 1, 2, 3, 4, 5]) {
    if (!seen.has(p) && p <= maxPages) {
      seen.add(p)
      candidatePages.push(p)
    }
  }

  try {
    for (const p of candidatePages) {
      if (!isCurrentIdentityReq()) return

      const cacheKey = `educator::roster::page::code_id=${targetCodeId}&page=${p}&page_size=${tablePageSize.value}`
      let payload = null
      const cached = cacheStore.get(cacheKey)
      if (cached && !cached.isExpired) {
        payload = cached.data
      } else {
        const reqKeyVersion = cacheStore.getKeyVersion(cacheKey)
        payload = await fetchClassroomStudents(targetCodeId, {
          page: p,
          page_size: tablePageSize.value,
        })
        if (!isCurrentIdentityReq()) return
        if (cacheStore.getKeyVersion(cacheKey) === reqKeyVersion) {
          cacheStore.set(cacheKey, payload, ROSTER_TTL)
        }
      }

      const list = Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.students)
          ? payload.students
          : []
      const match = list.find((s) => String(s.profile_id) === targetProfileId)
      if (match) {
        modalIdentity.value = match
        return
      }

      const totalCount = Number(payload?.total_count ?? list.length)
      const knownPages = Math.max(1, Math.ceil(totalCount / tablePageSize.value))
      if (p >= knownPages) {
        break
      }
    }
  } catch {
    // Graceful fallback: modal renders student profile summary even if roster identity fails.
  } finally {
    if (
      isComponentMounted &&
      reqId === modalIdentityRequestId &&
      authStore.activeSessionEpoch === reqAuthEpoch
    ) {
      isModalIdentityLoading.value = false
    }
  }
}

const openStudentAnalytics = (student) => {
  const codeId = effectiveCodeId.value
  const studentId = student?.profile_id ? String(student.profile_id) : ''
  if (!codeId || !studentId) return

  modalIdentity.value = student
  modalOpenedFromRoster.value = true

  const nextQuery = {
    ...route.query,
    student: studentId,
  }
  if (tablePage.value > 1) {
    nextQuery.table_page = String(tablePage.value)
  }

  router.push({
    path: route.path,
    query: nextQuery,
    hash: route.hash,
  })
}

const closeStudentModal = () => {
  const wasOpenedFromRoster = modalOpenedFromRoster.value
  modalOpenedFromRoster.value = false

  if (wasOpenedFromRoster) {
    router.back()
    return
  }

  const nextQuery = { ...route.query }
  delete nextQuery.student
  delete nextQuery.origin
  delete nextQuery.session
  router.replace({
    path: route.path,
    query: nextQuery,
    hash: route.hash,
  })
}

const goToTablePage = (targetPage) => {
  if (targetPage >= 1 && targetPage <= tableTotalPages.value && !isStudentsLoading.value) {
    tablePage.value = targetPage
    const nextQuery = { ...route.query }
    if (targetPage > 1) {
      nextQuery.table_page = String(targetPage)
    } else {
      delete nextQuery.table_page
    }
    router.push({
      path: route.path,
      query: nextQuery,
    })
    loadStudentRoster(effectiveCodeId.value, targetPage)
  }
}

// Formatters
const formatMapProgress = (progress) => {
  if (typeof progress === 'number' && Number.isInteger(progress) && progress >= 0 && progress < CANONICAL_MAPS.length) {
    return CANONICAL_MAPS[progress].name
  }
  return 'Unavailable'
}

const formatLastSynced = formatLastSyncedDate

const classroomBreakdownState = computed(() =>
  classifyCategoryBreakdown(classroomAnalytics.value?.category_fail_rates),
)

const hasValidAvgMapProgress = computed(() => {
  const val = classroomAnalytics.value?.avg_map_progress
  return typeof val === 'number' && Number.isFinite(val) && val >= 0
})

const formattedAvgMapProgress = computed(() => {
  if (!hasValidAvgMapProgress.value) return '—'
  return classroomAnalytics.value.avg_map_progress.toFixed(1)
})

const avgMapProgressBarStyle = computed(() => {
  if (!hasValidAvgMapProgress.value) return { width: '0%' }
  const clamped = Math.min(3, Math.max(0, classroomAnalytics.value.avg_map_progress))
  return { width: `${(clamped / 3) * 100}%` }
})

const mapScoreComparison = computed(() => {
  const rawScores = classroomAnalytics.value?.avg_best_score_by_map
  const entries = CANONICAL_MAPS.map((m) => {
    const raw = rawScores?.[m.name]
    const isPlayed = typeof raw === 'number' && Number.isFinite(raw) && raw >= 0
    return {
      name: m.name,
      isPlayed,
      rawScore: isPlayed ? raw : null,
      scoreLabel: isPlayed ? `${Math.round(raw)} pts` : 'Unplayed',
    }
  })

  const playedScores = entries.filter((item) => item.isPlayed).map((item) => item.rawScore)
  const maxScore = playedScores.length > 0 ? Math.max(...playedScores) : 0

  return entries.map((item) => {
    let barWidth = '0%'
    if (item.isPlayed && maxScore > 0) {
      barWidth = `${Math.round((item.rawScore / maxScore) * 100)}%`
    }
    return {
      ...item,
      barWidth,
    }
  })
})

// ==========================================
// Watchers
// ==========================================
// Watch table_page from query (supports browser Back/Forward)
watch(
  () => route.query.table_page,
  (newPageQuery) => {
    const parsed = parseQueryInt(newPageQuery, 1)
    if (parsed !== tablePage.value) {
      tablePage.value = parsed
      if (effectiveCodeId.value) {
        loadStudentRoster(effectiveCodeId.value, parsed)
      }
    }
  },
)

// Watch path changes to invalidate obsolete bare /analytics resolution if user leaves
watch(
  () => route.path,
  (newPath) => {
    if (newPath !== '/analytics') {
      bareRouteSeq++
    }
  },
)

// Watch Classroom Route Param Change (supports browser Back/Forward & client-side navigation between classrooms)
watch(
  () => route.params.code_id,
  (newCode, oldCode) => {
    bareRouteSeq++
    if (!authStore.isAuthenticated || !authStore.isEducator) {
      isAnalyticsLoading.value = false
      isStudentsLoading.value = false
      return
    }
    if (newCode) {
      if (newCode !== oldCode || (!classroomAnalytics.value && !aggregateErrorMessage.value)) {
        // Invalidate in-flight requests from previous classroom
        classroomRequestId++
        rosterRequestId++
        resetModalState()
        classroomAnalytics.value = null
        students.value = []
        tableTotalCount.value = 0
        hasConfirmedRoster.value = false
        aggregateErrorMessage.value = ''
        rosterErrorMessage.value = ''

        classroomStore.setCurrentClassroomId(newCode)
        if (!classroomStore.isFetched && !classroomStore.isLoading) {
          classroomStore.fetchClassrooms().catch(() => {})
        }

        const targetPage = parseQueryInt(route.query.table_page, 1)
        tablePage.value = targetPage
        loadClassroomData(newCode, targetPage)
      }
    } else {
      resolveBareAnalyticsRoute()
    }
  },
  { immediate: true },
)

// Clear private classroom analytics and roster state on logout or account switch
watch(
  [() => authStore.activeSessionEpoch, () => authStore.isAuthenticated, () => authStore.isEducator],
  ([, isAuth, isEd]) => {
    bareRouteSeq++
    classroomRequestId++
    rosterRequestId++
    resetModalState()
    classroomAnalytics.value = null
    students.value = []
    tableTotalCount.value = 0
    hasConfirmedRoster.value = false
    aggregateErrorMessage.value = ''
    rosterErrorMessage.value = ''

    if (!isComponentMounted || !isAuth || !isEd) {
      isAnalyticsLoading.value = false
      isStudentsLoading.value = false
      return
    }

    if (effectiveCodeId.value) {
      classroomStore.setCurrentClassroomId(effectiveCodeId.value)
      if (!classroomStore.isFetched && !classroomStore.isLoading) {
        classroomStore.fetchClassrooms().catch(() => {})
      }
      loadClassroomData(effectiveCodeId.value, tablePage.value)
    } else {
      resolveBareAnalyticsRoute()
    }
  },
)

// Watch active modal student query and classroom context to fetch student summary over Analytics
watch(
  [activeModalStudentId, effectiveCodeId, () => authStore.isAuthenticated, () => authStore.isEducator],
  ([studentId, codeId, isAuth, isEd], [prevStudentId, prevCodeId] = []) => {
    if (!studentId || !codeId || !isAuth || !isEd) {
      resetModalState()
      return
    }

    if (studentId !== prevStudentId || codeId !== prevCodeId) {
      modalAnalytics.value = null
      modalErrorMessage.value = ''
    }

    const existingIdentity =
      modalIdentity.value && String(modalIdentity.value.profile_id) === studentId
        ? modalIdentity.value
        : students.value.find((s) => String(s.profile_id) === studentId) || null
    modalIdentity.value = existingIdentity

    resolveModalStudentIdentity(codeId, studentId)
    loadModalStudentAnalytics(studentId)
  },
  { immediate: true },
)

// Populate modal identity once main roster loads when student is on the active roster page
watch(students, (list) => {
  if (!isStudentModalOpen.value || modalIdentity.value) return
  const match = list.find((s) => String(s.profile_id) === activeModalStudentId.value)
  if (match) {
    modalIdentity.value = match
    isModalIdentityLoading.value = false
  }
})

onMounted(() => {
  if (route.hash === '#students-roster') {
    nextTick(() => {
      jumpToStudents()
    })
  }
})

onUnmounted(() => {
  isComponentMounted = false
  bareRouteSeq++
  classroomRequestId++
  rosterRequestId++
  modalAnalyticsRequestId++
  modalIdentityRequestId++
})
</script>

<template>
  <div class="analytics-suite">
    <!-- Header Section: Shared Classroom Workspace Header -->
    <ClassroomWorkspaceHeader
      v-if="effectiveCodeId"
      page-title="Classroom analytics"
      :code-id="effectiveCodeId"
      active-tab="analytics"
      :student-count="hasConfirmedRoster && !rosterErrorMessage && !isStudentsLoading ? tableTotalCount : null"
      :is-count-loading="isStudentsLoading"
      :count-error="Boolean(rosterErrorMessage)"
      :originating-roster-page="tablePage"
      @retry-metadata="handleRetryMetadata"
    />

    <!-- Header fallback when no classroom is selected yet (bare /analytics loading/error) -->
    <header v-else class="bare-header">
      <div class="breadcrumb-bar">
        <router-link to="/classroom/manage" class="back-link">
          <AppIcon name="chevron-left" :size="15" />
          <span>Return to all classrooms</span>
        </router-link>
      </div>
      <h2 class="title">Classroom analytics</h2>
    </header>

    <!-- Error Banner for Bare /analytics List-Loading Failure -->
    <div v-if="classroomStore.error && !effectiveCodeId" class="error-banner" role="alert">
      <span>{{ classroomStore.error }}</span>
      <button
        type="button"
        class="btn-retry"
        :disabled="classroomStore.isLoading"
        @click="retryClassroomList"
      >
        Try again
      </button>
    </div>

    <!-- Main Loading State for Bare /analytics initial resolution -->
    <div v-else-if="classroomStore.isLoading && !effectiveCodeId" class="loading-state">
      <div class="spinner"></div>
      <p>Loading classroom analytics...</p>
    </div>

    <!-- Empty Classrooms State: Confirmed 0 classrooms -->
    <div v-else-if="classroomStore.isFetched && classroomStore.classrooms.length === 0" class="empty-state">
      <h2>No classrooms created yet</h2>
      <p>Create a classroom to enroll students and review classroom analytics.</p>
      <router-link to="/classroom/manage" class="btn-primary">
        <AppIcon name="plus" :size="15" />
        <span>Create classroom</span>
      </router-link>
    </div>

    <!-- Active Analytics Content -->
    <div v-else-if="effectiveCodeId" class="analytics-content">
      <!-- Error Banner for Aggregate Metrics (separate from metadata and roster) -->
      <div v-if="aggregateErrorMessage" class="error-banner" role="alert">
        <span>{{ aggregateErrorMessage }}</span>
        <button
          type="button"
          class="btn-retry"
          :disabled="isAnalyticsLoading"
          @click="loadAggregateAnalytics(effectiveCodeId, true)"
        >
          Try again
        </button>
      </div>

      <!-- SECTION 1: CLASSROOM SUMMARY -->
      <section class="section-card">
        <div class="card-header">
          <div class="header-titles">
            <h2 class="section-title">Classroom summary</h2>
            <span v-if="currentClassroom && currentClassroom.code_value" class="meta-tag">
              {{ currentClassroom.name }} · Code: {{ currentClassroom.code_value }}
            </span>
          </div>
          <div class="header-actions">
            <a
              v-if="effectiveCodeId"
              href="#students-roster"
              class="jump-students-link"
              @click.prevent="jumpToStudents"
            >
              <AppIcon name="users" :size="15" />
              <span>Jump to students</span>
            </a>
            <button
              type="button"
              class="refresh-btn"
              :disabled="isAnalyticsLoading || isStudentsLoading"
              @click="loadClassroomData(effectiveCodeId, tablePage, true)"
            >
              <AppIcon name="refresh" :size="14" />
              <span>{{ isAnalyticsLoading || isStudentsLoading ? 'Refreshing...' : 'Refresh data' }}</span>
            </button>
          </div>
        </div>

        <!-- Initial or cache-miss aggregate loading state -->
        <div
          v-if="isAnalyticsLoading && !classroomAnalytics"
          class="loading-state-sm analytics-overview-loading"
          role="status"
          aria-live="polite"
        >
          <div class="spinner-sm"></div>
          <p>Loading classroom summary...</p>
        </div>

        <!-- If aggregate analytics failed, show truthful unavailable state with independent retry -->
        <div
          v-else-if="aggregateErrorMessage || !classroomAnalytics"
          class="overview-unavailable-card"
          role="alert"
        >
          <p class="unavailable-message">{{ aggregateErrorMessage || 'Classroom summary is currently unavailable.' }}</p>
          <button
            type="button"
            class="btn-retry"
            :disabled="isAnalyticsLoading"
            @click="loadAggregateAnalytics(effectiveCodeId, true)"
          >
            Try again
          </button>
        </div>

        <!-- Two-Column Summary KPIs -->
        <div v-else class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-content">
              <span class="kpi-label">Enrolled students</span>
              <span class="kpi-value">
                {{
                  typeof classroomAnalytics?.student_count === 'number' &&
                  Number.isFinite(classroomAnalytics.student_count)
                    ? classroomAnalytics.student_count
                    : hasConfirmedRoster
                      ? tableTotalCount
                      : '—'
                }}
              </span>
              <p class="kpi-subnote">Current enrolled membership across this classroom.</p>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-content">
              <span class="kpi-label">Average map progress</span>
              <div class="kpi-value-row">
                <span class="kpi-value">{{ formattedAvgMapProgress }}</span>
                <span v-if="hasValidAvgMapProgress" class="kpi-unit">/ 3.0</span>
              </div>
              <div
                class="kpi-progress-track"
                :role="hasValidAvgMapProgress ? 'progressbar' : undefined"
                :aria-valuenow="hasValidAvgMapProgress ? Number(classroomAnalytics.avg_map_progress.toFixed(1)) : undefined"
                :aria-valuemin="hasValidAvgMapProgress ? 0 : undefined"
                :aria-valuemax="hasValidAvgMapProgress ? 3 : undefined"
                :aria-label="hasValidAvgMapProgress ? 'Average map unlock progress on a 0 to 3 scale' : undefined"
              >
                <div
                  v-if="hasValidAvgMapProgress"
                  class="kpi-progress-fill"
                  :style="avgMapProgressBarStyle"
                ></div>
              </div>
              <p class="kpi-subnote">Scale from Home (0) to Public Park (3).</p>
            </div>
          </div>
        </div>
      </section>

      <!-- SECTION 2: MAP SCORES AND THREAT ERROR RATES -->
      <section
        v-if="classroomAnalytics && !aggregateErrorMessage"
        class="section-card"
        aria-label="Map scores and threat error rates"
      >
        <div class="card-header">
          <div class="header-titles">
            <h2 class="section-title">Map scores and threat error rates</h2>
            <span class="meta-subtitle">
              Map best-score averages and classroom error rates across all 8 types of threats.
            </span>
          </div>
        </div>

        <!-- Average best score by map -->
        <div class="map-scores-section">
          <div class="subsection-header">
            <h3 class="subsection-title">Average best score by map</h3>
            <p class="subsection-hint">
              Average of one stored best score per current student for each map.
            </p>
          </div>
          <div class="map-bars-list">
            <div
              v-for="item in mapScoreComparison"
              :key="item.name"
              class="map-score-pill"
            >
              <span class="map-pill-name">{{ item.name }}:</span>
              <div
                class="map-bar-track"
                :role="item.isPlayed ? 'progressbar' : undefined"
                :aria-valuenow="item.isPlayed ? Math.round(item.rawScore) : undefined"
                :aria-valuemin="item.isPlayed ? 0 : undefined"
                :aria-label="item.isPlayed ? `${item.name} average best score` : undefined"
              >
                <div
                  v-if="item.isPlayed"
                  class="map-bar-fill"
                  :style="{ width: item.barWidth }"
                ></div>
              </div>
              <span v-if="item.isPlayed" class="map-pill-value">{{ item.scoreLabel }}</span>
              <span v-else class="map-pill-unplayed">Unplayed</span>
            </div>
          </div>
        </div>

        <!-- 8 DICT Threat Category Vulnerability Matrix -->
        <div class="threat-matrix-section" aria-label="Types of threats">
          <div class="matrix-header">
            <h3 class="subsection-title">Types of threats and error rates</h3>
            <span class="matrix-hint">
              Error rates measure uploaded decisions across current students for each type of threat.
            </span>
          </div>

          <div
            v-if="classroomBreakdownState.status === 'unavailable'"
            class="scoped-unavailable-banner"
            role="alert"
          >
            <AppIcon name="alert" :size="16" class="banner-icon" />
            <span>Decision error rate data is unavailable or incomplete.</span>
          </div>

          <div v-else class="threat-grid">
            <ThreatPerformanceGauge
              v-for="threat in CANONICAL_THREATS"
              :key="threat.name"
              :threat-name="threat.name"
              :fail-rate="classroomAnalytics?.category_fail_rates?.[threat.name] ?? null"
            />
          </div>
        </div>
      </section>

      <!-- SECTION 3: STUDENT PROGRESS ROSTER -->
      <section id="students-roster" ref="rosterSectionRef" class="section-card roster-section">
        <div class="card-header">
          <div class="header-titles">
            <h2 class="section-title">Student progress roster</h2>
            <span class="meta-subtitle">Select a student to inspect their progress summary.</span>
          </div>
        </div>

        <!-- Roster Error Banner with Independent Retry -->
        <div v-if="rosterErrorMessage" class="error-banner" role="alert">
          <span>{{ rosterErrorMessage }}</span>
          <button
            type="button"
            class="btn-retry"
            :disabled="isStudentsLoading"
            @click="loadStudentRoster(effectiveCodeId, tablePage, true)"
          >
            Try again
          </button>
        </div>

        <div v-if="isStudentsLoading" class="loading-state-sm">
          <div class="spinner-sm"></div>
          <p>Loading student roster...</p>
        </div>

        <div v-else-if="students.length > 0" class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Student name</th>
                <th>Map progress</th>
                <th>Threat index</th>
                <th>Last synced</th>
                <th class="text-right">Student progress</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="student in students" :key="student.profile_id">
                <td class="agent-cell">
                  <span class="agent-avatar">{{ student.username?.charAt(0).toUpperCase() || 'S' }}</span>
                  <div>
                    <span class="agent-name">{{ student.username }}</span>
                  </div>
                </td>
                <td>
                  <span class="badge-progression">
                    {{ formatMapProgress(student.map_progress) }}
                  </span>
                </td>
                <td>
                  <span class="threat-count-badge">
                    {{ formatThreatUnlockedCount(student.threat_unlocked_count, student.last_synced_at) }}
                  </span>
                </td>
                <td class="date-cell">
                  {{ formatLastSynced(student.last_synced_at) }}
                </td>
                <td class="text-right">
                  <button
                    type="button"
                    class="btn-inspect"
                    :data-student-profile-id="student.profile_id"
                    @click="openStudentAnalytics(student)"
                  >
                    View student progress
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Table Pagination Controls -->
          <div v-if="tableTotalCount > 0" class="pagination-bar">
            <div class="pagination-info">
              Showing <strong>{{ (tablePage - 1) * tablePageSize + 1 }}</strong> to
              <strong>{{ Math.min(tablePage * tablePageSize, tableTotalCount) }}</strong> of
              <strong>{{ tableTotalCount }}</strong> students
            </div>
            <div class="pagination-actions">
              <button
                type="button"
                class="page-btn"
                :disabled="tablePage <= 1 || isStudentsLoading"
                @click="goToTablePage(tablePage - 1)"
              >
                <AppIcon name="chevron-left" :size="15" />
                <span>Previous</span>
              </button>
              <span class="page-indicator">Page {{ tablePage }} of {{ tableTotalPages }}</span>
              <button
                type="button"
                class="page-btn"
                :disabled="tablePage >= tableTotalPages || isStudentsLoading"
                @click="goToTablePage(tablePage + 1)"
              >
                <span>Next</span>
                <AppIcon name="chevron-right" :size="15" />
              </button>
            </div>
          </div>
        </div>

        <div v-else-if="!rosterErrorMessage" class="empty-note">
          <p class="empty-note-copy">
            No students currently enrolled in this classroom. Share access code
            <strong>{{ currentClassroom?.code_value || '' }}</strong> with students to start tracking progress.
          </p>
          <router-link to="/classroom/manage" class="empty-return-link">
            Return to classrooms
          </router-link>
        </div>
      </section>
    </div>

    <StudentProgressModal
      :is-open="isStudentModalOpen"
      :student-id="activeModalStudentId"
      :student-identity="modalIdentity"
      :identity-loading="isModalIdentityLoading"
      :analytics="modalAnalytics"
      :loading="isModalAnalyticsLoading"
      :error="modalErrorMessage"
      :full-progress-route="modalFullProgressRoute"
      @close="closeStudentModal"
      @retry="loadModalStudentAnalytics(activeModalStudentId, true)"
    />
  </div>
</template>

<style scoped>
.analytics-suite {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: 100%;
}

.analytics-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: 100%;
}

/* Bare Header */
.bare-header {
  padding-bottom: 0.5rem;
}

.breadcrumb-bar {
  margin-bottom: 0.75rem;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--color-primary);
  font-family: var(--font-sans);
  font-size: 0.88rem;
  font-weight: 600;
  text-decoration: none;
  transition: opacity 0.2s ease;
}

.back-link:hover {
  text-decoration: underline;
  opacity: 0.85;
}

.title {
  margin: 0 0 0.35rem 0;
  color: var(--color-text-main);
  font-family: var(--font-display);
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.subtitle {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.95rem;
}

/* Section Card */
.section-card {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.overview-unavailable-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  background-color: var(--color-danger-bg);
  border: 1px solid var(--color-danger-border);
  color: var(--color-danger);
  padding: 1.25rem;
  border-radius: 8px;
  font-size: 0.95rem;
}

.unavailable-message {
  margin: 0;
  font-weight: 500;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 1rem;
  border-bottom: 1px solid var(--color-border-subtle);
  padding-bottom: 1rem;
}

.header-titles h2.section-title {
  margin: 0 0 0.25rem 0;
  color: var(--color-text-main);
  font-family: var(--font-display);
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.25;
}

.meta-subtitle {
  display: block;
  font-size: 0.88rem;
  color: var(--color-text-muted);
  line-height: 1.45;
}

.meta-tag {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--color-primary);
  font-weight: 600;
}

.header-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.65rem;
}

.jump-students-link {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 38px;
  background-color: var(--color-violet-subtle);
  border: 1px solid var(--color-violet-border);
  color: var(--color-primary);
  padding: 0.45rem 0.95rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  text-decoration: none;
  transition: background-color 180ms ease, border-color 180ms ease, color 180ms ease;
}

.jump-students-link:hover {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-primary);
}

.jump-students-link:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.roster-section {
  scroll-margin-top: 1.25rem;
}

.refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 38px;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  color: var(--color-text-main);
  padding: 0.45rem 0.95rem;
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 180ms ease, border-color 180ms ease, color 180ms ease;
}

.refresh-btn:hover:not(:disabled) {
  background-color: var(--color-violet-subtle);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.refresh-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* KPI Grid */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.kpi-card {
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 1.15rem 1.25rem;
  display: flex;
  align-items: flex-start;
}

.kpi-content {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  width: 100%;
}

.kpi-value-row {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
}

.kpi-value {
  font-family: var(--font-display);
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-primary);
  line-height: 1.15;
}

.kpi-unit {
  font-family: var(--font-mono);
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.kpi-label {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.kpi-progress-track {
  width: 100%;
  height: 8px;
  background-color: var(--color-bg-muted);
  border-radius: 9999px;
  overflow: hidden;
  margin-top: 0.2rem;
}

.kpi-progress-fill {
  height: 100%;
  background: var(--btn-gradient);
  border-radius: 9999px;
  transition: width 200ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.kpi-subnote {
  margin: 0.25rem 0 0 0;
  font-size: 0.8rem;
  line-height: 1.4;
  color: var(--color-text-muted);
}

/* Map Scores Subsection */
.map-scores-section {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.subsection-header,
.matrix-header {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.subsection-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--color-text-main);
}

.subsection-hint,
.matrix-hint {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-text-muted);
  line-height: 1.45;
}

.map-bars-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem 1rem;
}

.map-score-pill {
  display: grid;
  grid-template-columns: 6.75rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  padding: 0.75rem 1rem;
  border-radius: 10px;
  font-size: 0.88rem;
}

.map-pill-name {
  font-weight: 600;
  color: var(--color-text-main);
  white-space: nowrap;
}

.map-bar-track {
  width: 100%;
  height: 8px;
  background-color: var(--color-bg-muted);
  border-radius: 9999px;
  overflow: hidden;
}

.map-bar-fill {
  height: 100%;
  background: var(--btn-gradient);
  border-radius: 9999px;
  transition: width 200ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.map-pill-value {
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--color-primary);
  white-space: nowrap;
}

.map-pill-unplayed {
  font-size: 0.8rem;
  color: var(--color-text-dim);
  font-style: italic;
  white-space: nowrap;
}

/* Threat Matrix */
.threat-matrix-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--color-border-subtle);
}

.threat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
}

.scoped-unavailable-banner {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.85rem 1rem;
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text-muted);
  font-size: 0.88rem;
}

.scoped-unavailable-banner .banner-icon {
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.analytics-overview-loading p {
  margin: 0;
  font-size: 0.92rem;
}

/* Student Roster Table */
.table-container {
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid var(--color-border);
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.9rem;
}

.data-table th {
  background-color: var(--color-bg-subtle);
  color: var(--color-text-muted);
  font-family: var(--font-sans);
  padding: 0.85rem 1rem;
  font-size: 0.82rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1.5px solid var(--color-border);
}

.data-table td {
  padding: 0.9rem 1rem;
  border-bottom: 1px solid var(--color-border-subtle);
  color: var(--color-text-main);
}

.data-table tr:last-child td {
  border-bottom: none;
}

.data-table tr:hover {
  background-color: var(--color-bg-subtle);
}

.agent-cell {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.agent-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: var(--color-violet-subtle);
  color: var(--color-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.85rem;
  border: 1px solid var(--color-border);
}

.agent-name {
  font-weight: 600;
  color: var(--color-text-main);
}

.badge-progression {
  display: inline-block;
  padding: 0.25rem 0.65rem;
  background-color: var(--color-bg-subtle);
  color: var(--color-primary);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 0.82rem;
  font-weight: 600;
}

.threat-count-badge {
  display: inline-block;
  padding: 0.25rem 0.65rem;
  background-color: var(--color-bg-subtle);
  color: var(--color-text-main);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 0.82rem;
  font-weight: 500;
}

.date-cell {
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

.text-right {
  text-align: right;
}

.btn-inspect {
  padding: 0.45rem 0.9rem;
  background-color: var(--color-card);
  color: var(--color-primary);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 180ms ease, border-color 180ms ease;
}

.btn-inspect:hover {
  background-color: var(--color-violet-subtle);
  border-color: var(--color-primary);
}

.btn-inspect:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Generic States */
.loading-state,
.empty-state {
  text-align: center;
  padding: 3rem 1.5rem;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  color: var(--color-text-muted);
  box-shadow: var(--shadow-card);
}

.empty-state h2 {
  margin: 0 0 0.5rem 0;
  color: var(--color-text-main);
  font-family: var(--font-display);
  font-size: 1.25rem;
}

.empty-state p {
  margin: 0;
}

.loading-state-sm {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--color-text-muted);
}

.spinner {
  width: 36px;
  height: 36px;
  margin: 0 auto 1rem auto;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.spinner-sm {
  width: 24px;
  height: 24px;
  margin: 0 auto 0.5rem auto;
  border: 2.5px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-banner {
  background-color: var(--color-danger-bg);
  border: 1px solid var(--color-danger-border);
  color: var(--color-danger);
  padding: 0.85rem 1.25rem;
  border-radius: 8px;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.btn-retry {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.75rem;
  background-color: var(--color-card);
  color: var(--color-danger);
  border: 1px solid var(--color-danger-border);
  border-radius: 6px;
  font-family: var(--font-sans);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-retry:hover:not(:disabled) {
  background-color: var(--color-danger-bg);
}

.btn-retry:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-bar {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem;
  border-top: 1px solid var(--color-border);
  gap: 1rem;
}

.pagination-info {
  font-size: 0.9rem;
  color: var(--color-text-muted);
}

.pagination-info strong {
  color: var(--color-primary);
}

.pagination-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.page-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.9rem;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  color: var(--color-primary);
  transition: background-color 180ms ease, border-color 180ms ease;
}

.page-btn:hover:not(:disabled) {
  background-color: var(--color-violet-subtle);
  border-color: var(--color-primary);
}

.page-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.page-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.page-indicator {
  font-size: 0.88rem;
  font-weight: 500;
  color: var(--color-text-muted);
}

.empty-note {
  text-align: center;
  color: var(--color-text-muted);
  padding: 1.5rem 0;
  font-size: 0.9rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.empty-note-copy {
  margin: 0;
}

.empty-return-link {
  display: inline-flex;
  align-items: center;
  padding: 0.45rem 0.95rem;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background-color: var(--color-bg-subtle);
  color: var(--color-primary);
  font-size: 0.85rem;
  font-weight: 600;
  text-decoration: none;
  transition: border-color 180ms ease, background-color 180ms ease;
}

.empty-return-link:hover {
  border-color: var(--color-primary);
  background-color: var(--color-violet-subtle);
}

.empty-return-link:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  margin-top: 1rem;
  padding: 0.65rem 1.35rem;
  background: var(--btn-gradient);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.92rem;
  text-decoration: none;
  cursor: pointer;
  box-shadow: var(--shadow-purple-sm);
  transition: background 180ms ease;
}

.btn-primary:hover {
  background: var(--btn-gradient-hover);
}

.btn-primary:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

@media (max-width: 960px) {
  .roster-section {
    scroll-margin-top: 4.75rem;
  }
}

@media (max-width: 640px) {
  .section-card {
    padding: 1.25rem 1rem;
  }

  .jump-students-link,
  .refresh-btn,
  .btn-inspect,
  .page-btn {
    min-height: 44px;
  }

  .kpi-grid {
    grid-template-columns: 1fr;
  }

  .map-bars-list {
    grid-template-columns: 1fr;
  }

  .map-score-pill {
    grid-template-columns: 5.75rem minmax(0, 1fr) auto;
    gap: 0.55rem;
    padding: 0.65rem 0.85rem;
  }

  .pagination-bar {
    padding: 1rem 0.75rem;
    justify-content: center;
  }

  .threat-grid {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .kpi-progress-fill,
  .map-bar-fill,
  .jump-students-link,
  .refresh-btn,
  .page-btn,
  .btn-inspect,
  .btn-primary {
    transition: none;
  }
}

:global([data-reduced-motion='true']) .kpi-progress-fill,
:global([data-reduced-motion='true']) .map-bar-fill,
:global([data-reduced-motion='true']) .jump-students-link,
:global([data-reduced-motion='true']) .refresh-btn,
:global([data-reduced-motion='true']) .page-btn,
:global([data-reduced-motion='true']) .btn-inspect,
:global([data-reduced-motion='true']) .btn-primary {
  transition: none;
}
</style>
