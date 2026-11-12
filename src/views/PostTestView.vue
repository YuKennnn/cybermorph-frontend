<script setup>
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '../stores/authStore.js'
import { usePostTestStore } from '../stores/postTestStore.js'
import { isPostTestMockEnabled } from '../api/postTest.js'
import { CANONICAL_THREAT_CATEGORIES_ORDER, POST_TEST_CONFIG } from '../utils/postTestEngine.js'
import { resolveHighestUnlockedMapName } from '../utils/playerSessions.js'
import AppIcon from '../components/common/AppIcon.vue'

// Compiled out completely during production `vite build` when DEV is false
const PostTestDevPreviewBar =
  import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === 'true'
    ? defineAsyncComponent(() => import('../components/postTest/PostTestDevPreviewBar.vue'))
    : null

const authStore = useAuthStore()
const postTestStore = usePostTestStore()
const explanationFilter = ref('all')

const CHOICE_SLOT_LETTERS = Object.freeze(['A', 'B', 'C', 'D'])

const activeAttempt = computed(() => postTestStore.currentAttempt)
const activeQuestion = computed(() => postTestStore.currentQuestion)
const result = computed(() => postTestStore.lastResult)
const scoreSummary = computed(() => postTestStore.scoreSummary)

const selectedChoiceId = computed(() => {
  if (!activeAttempt.value || !activeQuestion.value) return null
  return activeAttempt.value.answers?.[activeQuestion.value.id] || null
})

const quizProgressPercent = computed(() => {
  const total = activeAttempt.value?.totalQuestions || POST_TEST_CONFIG.totalQuestions
  return Math.min(100, Math.round((postTestStore.answeredCount / total) * 100))
})

const isLastQuestion = computed(() => {
  if (!activeAttempt.value) return false
  return activeAttempt.value.currentIndex >= activeAttempt.value.questions.length - 1
})

const mapUnlockName = computed(() => {
  const mp = postTestStore.eligibility?.mapProgress
  return typeof mp === 'number' ? resolveHighestUnlockedMapName(mp) : null
})

const statusBadge = computed(() => {
  const current = postTestStore.status
  if (current === 'unavailable') return { label: 'Unavailable on server', tone: 'neutral' }
  if (current === 'loading' || current === 'idle') return { label: 'Loading', tone: 'neutral' }
  if (current === 'error') return { label: 'Error', tone: 'danger' }
  if (current === 'locked') return { label: 'Locked', tone: 'warning' }
  if (current === 'in-progress') {
    return { label: `In progress · ${postTestStore.answeredCount}/30`, tone: 'primary' }
  }
  if (current === 'review') {
    return { label: 'Reviewing answers', tone: 'primary' }
  }
  if (current === 'results' && result.value) {
    return result.value.passed
      ? { label: 'Passed', tone: 'success' }
      : { label: 'Not passed', tone: 'danger' }
  }
  return { label: 'Available', tone: 'primary' }
})

const incorrectItemsCount = computed(() => {
  if (!result.value || !Array.isArray(result.value.items)) return 0
  return result.value.items.filter((item) => !item.isCorrect).length
})

const filteredExplanationItems = computed(() => {
  if (!result.value || !Array.isArray(result.value.items)) return []
  if (explanationFilter.value === 'incorrect') {
    return result.value.items.filter((item) => !item.isCorrect)
  }
  if (explanationFilter.value === 'correct') {
    return result.value.items.filter((item) => item.isCorrect)
  }
  return result.value.items
})

const getAnswerPreviewText = (question) => {
  if (!activeAttempt.value || !question) return 'Not answered'
  const selectedId = activeAttempt.value.answers?.[question.id]
  if (!selectedId) return 'Not answered'
  const match = question.choices.find((choice) => choice.id === selectedId)
  return match ? match.text : 'Answered'
}

const formatScoreSummaryItem = (entry) => {
  if (!entry) return '—'
  return `${entry.correctCount}/${entry.totalCount} (${entry.percentage}%)`
}

const handleSelectAnswer = (questionId, choiceId) => {
  postTestStore.selectAnswer(questionId, choiceId)
}

const handleStart = async () => {
  if (!isPostTestMockEnabled() && !postTestStore.isBackendSupported) return
  await postTestStore.startAttempt()
}

const handleSubmit = async () => {
  if (!isPostTestMockEnabled() && !postTestStore.isBackendSupported) return
  explanationFilter.value = 'all'
  await postTestStore.submitAttempt()
}

const handleRetake = async () => {
  if (!isPostTestMockEnabled() && !postTestStore.isBackendSupported) return
  explanationFilter.value = 'all'
  await postTestStore.retakeAttempt()
}

watch(
  () => `${authStore.activeSessionEpoch}::${authStore.token || ''}`,
  (nextScope, prevScope) => {
    if (nextScope === prevScope) return
    explanationFilter.value = 'all'
    if (authStore.isAuthenticated && authStore.isPlayer) {
      postTestStore.loadOverview()
    } else {
      postTestStore.reset()
    }
  },
)

onMounted(() => {
  postTestStore.loadOverview()
})
</script>

<template>
  <div class="post-test-page">
    <!-- Dev-only preview switcher (only compiled/rendered in dev mock mode) -->
    <component :is="PostTestDevPreviewBar" v-if="PostTestDevPreviewBar" />

    <!-- Page Header -->
    <header class="page-header">
      <div class="header-identity">
        <div class="header-icon" aria-hidden="true">
          <AppIcon name="clipboard-check" :size="20" />
        </div>
        <div class="header-text">
          <div class="header-title-row">
            <h1 class="page-title">Post-test</h1>
            <span class="status-badge" :class="`tone-${statusBadge.tone}`">
              {{ statusBadge.label }}
            </span>
          </div>
          <p class="header-subtitle">
            30-question cybersecurity knowledge check covering all eight CyberMorph threat categories.
          </p>
        </div>
      </div>

      <router-link to="/dashboard" class="btn-outline back-link">
        <AppIcon name="arrow-left" :size="15" />
        <span>Back to overview</span>
      </router-link>
    </header>

    <!-- Honest Production / Non-Mock Unavailable State -->
    <section
      v-if="postTestStore.status === 'unavailable' || !postTestStore.isActionSupported"
      class="surface-panel state-panel"
      aria-labelledby="unavailable-heading"
    >
      <div class="state-icon-box tone-neutral" aria-hidden="true">
        <AppIcon name="info" :size="22" />
      </div>
      <h2 id="unavailable-heading" class="panel-heading">Post-test is not available yet</h2>
      <p class="panel-copy">
        The CyberMorph backend server does not currently provide assessment endpoints. Starting or
        submitting web post-test attempts is disabled until backend support is connected.
      </p>
      <p class="panel-copy muted">
        Your map progress, session history, and unlocked Threat index dossiers remain available while
        you continue practicing in CyberMorph.
      </p>
      <div class="panel-actions">
        <button
          type="button"
          class="btn-primary"
          disabled
          aria-disabled="true"
        >
          Start post-test (unavailable)
        </button>
        <router-link to="/threat-index" class="btn-outline">
          Open threat index
        </router-link>
      </div>
    </section>

    <!-- Loading State -->
    <section
      v-else-if="postTestStore.status === 'loading' || postTestStore.status === 'idle'"
      class="surface-panel state-panel"
      role="status"
      aria-live="polite"
    >
      <div class="spinner" aria-hidden="true"></div>
      <h2 class="panel-heading">Checking post-test readiness...</h2>
      <p class="panel-copy muted">Preparing player eligibility and assessment details.</p>
    </section>

    <!-- Error State -->
    <section
      v-else-if="postTestStore.status === 'error'"
      class="surface-panel state-panel error-surface"
      role="alert"
    >
      <div class="state-icon-box tone-danger" aria-hidden="true">
        <AppIcon name="warning" :size="22" />
      </div>
      <h2 class="panel-heading">Could not load post-test</h2>
      <p class="panel-copy">{{ postTestStore.errorMessage }}</p>
      <div class="panel-actions">
        <button type="button" class="btn-primary" @click="postTestStore.retryLoad">
          <AppIcon name="refresh" :size="15" />
          <span>Retry</span>
        </button>
        <router-link to="/dashboard" class="btn-outline">Back to overview</router-link>
      </div>
    </section>

    <!-- Locked State -->
    <section
      v-else-if="postTestStore.status === 'locked'"
      class="surface-panel locked-panel"
      aria-labelledby="locked-heading"
    >
      <div class="state-icon-box tone-warning" aria-hidden="true">
        <AppIcon name="lock" :size="22" />
      </div>
      <h2 id="locked-heading" class="panel-heading">Complete Public Park to unlock the post-test</h2>
      <p class="panel-copy">
        Intended eligibility requires completing the <strong>Public Park</strong> map in CyberMorph by
        reaching its required <strong>Security Credits</strong> target.
      </p>

      <div class="info-callout" role="note">
        <AppIcon name="info" :size="16" class="callout-icon" />
        <div class="callout-text">
          <template v-if="postTestStore.eligibility?.publicParkUnlocked">
            Your profile currently shows <strong>map progress 3 (Public Park unlocked)</strong>. That
            indicates you can enter Public Park, not that you have finished it. Reach the required
            Security Credits inside Public Park to unlock the post-test.
          </template>
          <template v-else-if="mapUnlockName">
            Your highest unlocked map is currently <strong>{{ mapUnlockName }}</strong>
            (map progress {{ postTestStore.eligibility?.mapProgress }}/3). Unlock Public Park and earn
            its required Security Credits to open the post-test.
          </template>
          <template v-else>
            Play through CyberMorph maps up to Public Park and reach its required Security Credits to
            unlock the post-test. Classroom membership is not required.
          </template>
        </div>
      </div>

      <p class="panel-copy muted">
        Independent play is the complete experience — joining a classroom is optional and not required
        to unlock or take the post-test.
      </p>

      <div class="panel-actions">
        <router-link to="/threat-index" class="btn-primary">
          <AppIcon name="shield" :size="15" />
          <span>Review threat index</span>
        </router-link>
        <router-link to="/dashboard" class="btn-outline">Back to overview</router-link>
      </div>
    </section>

    <!-- Introduction View -->
    <section
      v-else-if="postTestStore.status === 'available'"
      class="surface-panel intro-panel"
      aria-labelledby="intro-heading"
    >
      <div class="intro-top">
        <h2 id="intro-heading" class="panel-heading">Before you begin</h2>
        <p class="panel-copy">
          Evaluate realistic digital safety situations drawn across all eight CyberMorph threat
          categories. Take your time and choose the safest single response for each question.
        </p>
      </div>

      <dl class="rules-grid">
        <div class="rule-item">
          <dt class="rule-label">Questions</dt>
          <dd class="rule-value">30 multiple-choice items</dd>
          <dd class="rule-detail">
            Randomly drawn across all 8 threat categories with unique underlying scenarios where available.
          </dd>
        </div>
        <div class="rule-item">
          <dt class="rule-label">Passing requirement</dt>
          <dd class="rule-value">75% or higher (at least 23/30)</dd>
          <dd class="rule-detail">
            23 or more correct answers passes. A score of 22/30 (73.3%) requires another attempt.
          </dd>
        </div>
        <div class="rule-item">
          <dt class="rule-label">Pacing & retakes</dt>
          <dd class="rule-value">No timer · Unlimited retakes</dd>
          <dd class="rule-detail">
            Review or change any answer before submitting. Each retake builds a fresh 30-question draw.
          </dd>
        </div>
        <div class="rule-item">
          <dt class="rule-label">Eligibility & feedback</dt>
          <dd class="rule-value">Unlocked · Independent play</dd>
          <dd class="rule-detail">
            No classroom membership needed. Answer explanations become visible right after submission.
          </dd>
        </div>
      </dl>

      <div class="categories-strip">
        <span class="strip-label">Eight threat categories included:</span>
        <ul class="category-chips">
          <li v-for="category in CANONICAL_THREAT_CATEGORIES_ORDER" :key="category" class="cat-chip">
            {{ category }}
          </li>
        </ul>
      </div>

      <div v-if="scoreSummary.attemptCount > 0" class="previous-scores-strip">
        <div class="strip-heading-row">
          <span class="strip-label">Session prototype history ({{ scoreSummary.attemptCount }} attempt{{ scoreSummary.attemptCount === 1 ? '' : 's' }})</span>
          <span class="local-note">Stored locally in dev preview only · Not saved to backend</span>
        </div>
        <div class="score-trio">
          <div class="score-pill-box">
            <span class="trio-label">First</span>
            <strong class="trio-value">{{ formatScoreSummaryItem(scoreSummary.firstScore) }}</strong>
          </div>
          <div class="score-pill-box">
            <span class="trio-label">Latest</span>
            <strong class="trio-value">{{ formatScoreSummaryItem(scoreSummary.latestScore) }}</strong>
          </div>
          <div class="score-pill-box">
            <span class="trio-label">Best</span>
            <strong class="trio-value">{{ formatScoreSummaryItem(scoreSummary.bestScore) }}</strong>
          </div>
        </div>
      </div>

      <div class="panel-actions">
        <button
          type="button"
          class="btn-primary start-btn"
          :disabled="postTestStore.isStarting"
          @click="handleStart"
        >
          <span>{{ postTestStore.isStarting ? 'Preparing questions...' : 'Start post-test' }}</span>
          <AppIcon name="arrow-right" :size="15" />
        </button>
      </div>
    </section>

    <!-- Quiz Screen (One Question at a Time) -->
    <div
      v-else-if="postTestStore.status === 'in-progress' && activeAttempt && activeQuestion"
      class="quiz-workspace"
    >
      <section class="surface-panel quiz-main" aria-labelledby="quiz-question-heading">
        <div class="quiz-progress-header">
          <div class="quiz-meta-left">
            <span class="question-counter">
              Question {{ activeQuestion.displayNumber }} of {{ activeAttempt.totalQuestions }}
            </span>
            <span class="threat-pill">{{ activeQuestion.threat_name }}</span>
          </div>
          <span class="answered-tally">
            {{ postTestStore.answeredCount }} of {{ activeAttempt.totalQuestions }} answered
          </span>
        </div>

        <div class="quiz-progress-track" aria-hidden="true">
          <div class="quiz-progress-fill" :style="{ width: `${quizProgressPercent}%` }"></div>
        </div>

        <fieldset
          class="quiz-fieldset"
          :data-question-id="activeQuestion.id"
        >
          <legend id="quiz-question-heading" class="quiz-question-text">
            {{ activeQuestion.question }}
          </legend>

          <div class="choices-list" role="radiogroup" :aria-labelledby="'quiz-question-heading'">
            <label
              v-for="(choice, idx) in activeQuestion.choices"
              :key="choice.id"
              class="choice-option"
              :class="{ 'is-selected': selectedChoiceId === choice.id }"
              :data-choice-id="choice.id"
            >
              <input
                type="radio"
                class="choice-radio-input"
                :name="`post-test-q-${activeQuestion.id}`"
                :value="choice.id"
                :checked="selectedChoiceId === choice.id"
                @change="handleSelectAnswer(activeQuestion.id, choice.id)"
              />
              <span class="choice-letter" aria-hidden="true">{{ CHOICE_SLOT_LETTERS[idx] || '?' }}</span>
              <span class="choice-text">{{ choice.text }}</span>
            </label>
          </div>
        </fieldset>

        <div class="quiz-actions-footer">
          <button
            type="button"
            class="btn-outline"
            :disabled="activeAttempt.currentIndex === 0"
            @click="postTestStore.prevQuestion"
          >
            <AppIcon name="chevron-left" :size="15" />
            <span>Previous</span>
          </button>

          <div class="quiz-right-actions">
            <button
              type="button"
              class="btn-subtle"
              @click="postTestStore.openReview"
            >
              Review ({{ postTestStore.answeredCount }}/{{ activeAttempt.totalQuestions }})
            </button>

            <button
              v-if="!isLastQuestion"
              type="button"
              class="btn-primary"
              @click="postTestStore.nextQuestion"
            >
              <span>Next</span>
              <AppIcon name="chevron-right" :size="15" />
            </button>

            <button
              v-else
              type="button"
              class="btn-primary"
              @click="postTestStore.openReview"
            >
              <span>Review answers</span>
              <AppIcon name="arrow-right" :size="15" />
            </button>
          </div>
        </div>
      </section>

      <!-- Question Navigator -->
      <aside class="surface-panel navigator-panel" aria-label="Question navigator">
        <div class="navigator-header">
          <h2 class="navigator-title">Questions</h2>
          <span class="navigator-count">{{ postTestStore.answeredCount }}/30 answered</span>
        </div>

        <div class="navigator-legend" aria-hidden="true">
          <span class="legend-item"><i class="dot dot-current"></i> Current</span>
          <span class="legend-item"><i class="dot dot-answered"></i> Answered</span>
          <span class="legend-item"><i class="dot dot-empty"></i> Open</span>
        </div>

        <div class="navigator-grid" role="list">
          <button
            v-for="(q, idx) in activeAttempt.questions"
            :key="q.id"
            type="button"
            role="listitem"
            class="nav-pip"
            :class="{
              'is-current': idx === activeAttempt.currentIndex,
              'is-answered': Boolean(activeAttempt.answers?.[q.id]),
            }"
            :aria-current="idx === activeAttempt.currentIndex ? 'step' : undefined"
            :aria-label="`Question ${q.displayNumber}, ${activeAttempt.answers?.[q.id] ? 'answered' : 'unanswered'}`"
            @click="postTestStore.goToQuestion(idx)"
          >
            {{ q.displayNumber }}
          </button>
        </div>

        <button
          type="button"
          class="btn-outline navigator-review-btn"
          @click="postTestStore.openReview"
        >
          Go to review step
        </button>
      </aside>
    </div>

    <!-- Review Step Before Submission -->
    <section
      v-else-if="postTestStore.status === 'review' && activeAttempt"
      class="surface-panel review-panel"
      aria-labelledby="review-heading"
    >
      <div class="review-header">
        <div>
          <h2 id="review-heading" class="panel-heading">Review your answers</h2>
          <p class="panel-copy">
            {{ postTestStore.answeredCount }} of {{ activeAttempt.totalQuestions }} answered.
            Passing requires at least 23/30 correct answers (75%).
          </p>
        </div>
      </div>

      <div
        v-if="postTestStore.unansweredQuestionNumbers.length > 0"
        class="review-warning-banner"
        role="status"
      >
        <div class="banner-row">
          <AppIcon name="warning" :size="18" class="warning-icon" />
          <div>
            <strong>
              {{ postTestStore.unansweredQuestionNumbers.length }} unanswered question{{
                postTestStore.unansweredQuestionNumbers.length === 1 ? '' : 's'
              }}
            </strong>
            <p class="warning-sub">
              Unanswered items earn 0 points. Select a question number below to return and complete
              it before submitting.
            </p>
          </div>
        </div>
        <div class="unanswered-chips">
          <button
            v-for="num in postTestStore.unansweredQuestionNumbers"
            :key="num"
            type="button"
            class="unanswered-chip"
            @click="postTestStore.goToQuestion(num - 1)"
          >
            Question {{ num }}
          </button>
        </div>
      </div>

      <div v-else class="review-ready-banner" role="status">
        <AppIcon name="check" :size="18" />
        <span>All 30 questions have a selected answer. Ready to submit when you are.</span>
      </div>

      <div class="review-grid" role="list" aria-label="All post-test questions summary">
        <button
          v-for="(q, idx) in activeAttempt.questions"
          :key="q.id"
          type="button"
          role="listitem"
          class="review-row-btn"
          :class="{ 'is-unanswered': !activeAttempt.answers?.[q.id] }"
          @click="postTestStore.goToQuestion(idx)"
        >
          <span class="review-num">Q{{ q.displayNumber }}</span>
          <span class="review-cat">{{ q.threat_name }}</span>
          <span class="review-status-pill" :class="{ 'is-missing': !activeAttempt.answers?.[q.id] }">
            {{ activeAttempt.answers?.[q.id] ? 'Answered' : 'Unanswered' }}
          </span>
          <span class="review-answer-snippet">{{ getAnswerPreviewText(q) }}</span>
        </button>
      </div>

      <div class="review-footer-actions">
        <button type="button" class="btn-outline" @click="postTestStore.backToQuiz">
          <AppIcon name="arrow-left" :size="15" />
          <span>Back to questions</span>
        </button>

        <button
          type="button"
          class="btn-primary submit-btn"
          :disabled="postTestStore.isSubmitting || !postTestStore.isActionSupported"
          @click="handleSubmit"
        >
          <AppIcon name="check" :size="15" />
          <span>
            {{
              postTestStore.isSubmitting
                ? 'Scoring answers...'
                : postTestStore.unansweredQuestionNumbers.length > 0
                  ? `Submit anyway (${postTestStore.unansweredQuestionNumbers.length} unanswered)`
                  : 'Submit post-test'
            }}
          </span>
        </button>
      </div>
    </section>

    <!-- Results Screen -->
    <div v-else-if="postTestStore.status === 'results' && result" class="results-layout">
      <div class="mock-notice-banner" role="note">
        <AppIcon name="info" :size="16" />
        <span>
          <strong>Prototype result only:</strong> This mock score is calculated locally in your
          browser session and is not saved to a backend database.
        </span>
      </div>

      <section
        class="surface-panel result-hero"
        :class="result.passed ? 'is-passed' : 'is-failed'"
        aria-labelledby="results-heading"
      >
        <div class="result-hero-main">
          <div class="result-score-block">
            <span class="result-outcome-pill" :class="result.passed ? 'is-pass' : 'is-fail'">
              <AppIcon :name="result.passed ? 'check' : 'x'" :size="15" />
              {{ result.passed ? 'Passed' : 'Not passed' }}
            </span>
            <h2 id="results-heading" class="result-score-display">
              {{ result.correctCount }} / {{ result.totalCount }}
              <span class="result-percent">({{ result.percentage }}%)</span>
            </h2>
            <p class="panel-copy">
              <template v-if="result.passed">
                You met the 75% passing requirement (at least 23/30 correct answers).
              </template>
              <template v-else>
                Passing requires at least 23/30 correct answers (75%). Review the explanations below
                and try a fresh retake whenever you are ready.
              </template>
            </p>
          </div>

          <div class="result-hero-actions">
            <button
              type="button"
              class="btn-primary retake-btn"
              :disabled="postTestStore.isStarting || !postTestStore.isActionSupported"
              @click="handleRetake"
            >
              <AppIcon name="refresh" :size="15" />
              <span>{{ postTestStore.isStarting ? 'Preparing retake...' : 'Retake post-test' }}</span>
            </button>
            <router-link to="/threat-index" class="btn-outline">Review threat index</router-link>
          </div>
        </div>

        <!-- Distinct First / Latest / Best Score Trio -->
        <div class="score-trio results-trio" aria-label="Mock attempt score summary">
          <div class="score-pill-box">
            <span class="trio-label">First score</span>
            <strong class="trio-value">{{ formatScoreSummaryItem(scoreSummary.firstScore) }}</strong>
          </div>
          <div class="score-pill-box">
            <span class="trio-label">Latest score</span>
            <strong class="trio-value">{{ formatScoreSummaryItem(scoreSummary.latestScore) }}</strong>
          </div>
          <div class="score-pill-box">
            <span class="trio-label">Best score</span>
            <strong class="trio-value">{{ formatScoreSummaryItem(scoreSummary.bestScore) }}</strong>
          </div>
          <div class="score-pill-box">
            <span class="trio-label">Completed attempts</span>
            <strong class="trio-value">{{ scoreSummary.attemptCount }}</strong>
          </div>
        </div>
      </section>

      <!-- Category Breakdown -->
      <section class="surface-panel breakdown-panel" aria-labelledby="breakdown-heading">
        <h2 id="breakdown-heading" class="section-heading">Results by threat category</h2>
        <div class="breakdown-grid">
          <div
            v-for="cat in result.categoryBreakdown"
            :key="cat.threat_name"
            class="breakdown-row"
          >
            <span class="breakdown-name">{{ cat.threat_name }}</span>
            <span class="breakdown-score">
              {{ cat.correct }}/{{ cat.asked }}
              <span v-if="cat.percentage !== null" class="breakdown-pct">({{ cat.percentage }}%)</span>
            </span>
          </div>
        </div>
      </section>

      <!-- Answer Review & Explanations (post-submission only) -->
      <section class="surface-panel explanations-panel" aria-labelledby="explanations-heading">
        <div class="explanations-header">
          <div>
            <h2 id="explanations-heading" class="section-heading">Answer review & explanations</h2>
            <p class="panel-copy muted">Explanations are shown for learning after submission.</p>
          </div>

          <div class="segmented-filter" role="group" aria-label="Filter answer explanations">
            <button
              type="button"
              class="filter-pill"
              :class="{ 'is-active': explanationFilter === 'all' }"
              @click="explanationFilter = 'all'"
            >
              All ({{ result.items.length }})
            </button>
            <button
              type="button"
              class="filter-pill"
              :class="{ 'is-active': explanationFilter === 'incorrect' }"
              @click="explanationFilter = 'incorrect'"
            >
              Incorrect ({{ incorrectItemsCount }})
            </button>
            <button
              type="button"
              class="filter-pill"
              :class="{ 'is-active': explanationFilter === 'correct' }"
              @click="explanationFilter = 'correct'"
            >
              Correct ({{ result.correctCount }})
            </button>
          </div>
        </div>

        <div v-if="filteredExplanationItems.length === 0" class="empty-filter-note">
          No questions match this filter.
        </div>

        <ol v-else class="explanations-list">
          <li
            v-for="item in filteredExplanationItems"
            :key="item.id"
            class="explanation-item"
            :class="item.isCorrect ? 'is-item-correct' : 'is-item-incorrect'"
          >
            <div class="explanation-meta">
              <div class="explanation-left-meta">
                <span class="exp-num">Question {{ item.displayNumber }}</span>
                <span class="threat-pill small">{{ item.threat_name }}</span>
              </div>
              <span class="exp-badge" :class="item.isCorrect ? 'is-pass' : 'is-fail'">
                <AppIcon :name="item.isCorrect ? 'check' : 'x'" :size="13" />
                {{ item.isCorrect ? 'Correct' : 'Incorrect' }}
              </span>
            </div>

            <p class="exp-question">{{ item.question }}</p>

            <div class="exp-answers">
              <p class="exp-answer-line">
                <span class="exp-label">Your answer:</span>
                <span>{{ item.selectedChoiceText || 'Unanswered (0 points)' }}</span>
              </p>
              <p v-if="!item.isCorrect" class="exp-answer-line is-best">
                <span class="exp-label">Best answer:</span>
                <span>{{ item.correctChoiceText }}</span>
              </p>
              <p class="exp-rationale">
                <span class="exp-label">Why:</span>
                <span>{{ item.explanation }}</span>
              </p>
            </div>
          </li>
        </ol>
      </section>
    </div>
  </div>
</template>

<style scoped>
.post-test-page {
  display: flex;
  flex-direction: column;
  gap: 1.35rem;
  width: 100%;
  min-width: 0;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem 1.25rem;
  padding: 1.15rem 1.4rem;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  box-shadow: var(--shadow-card);
}

.header-identity {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  min-width: 0;
  flex: 1 1 280px;
}

.header-icon {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background-color: var(--color-violet-subtle);
  border: 1px solid var(--color-violet-border);
  color: var(--color-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.header-text {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 0;
}

.header-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.page-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(1.35rem, 2vw, 1.65rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--color-text-main);
  line-height: 1.15;
}

.header-subtitle {
  margin: 0;
  font-size: 0.9rem;
  color: var(--color-text-muted);
  line-height: 1.4;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.18rem 0.62rem;
  border-radius: 999px;
  font-size: 0.76rem;
  font-weight: 700;
  line-height: 1.3;
  border: 1px solid var(--color-border);
}

.status-badge.tone-primary {
  background-color: var(--color-violet-subtle);
  border-color: var(--color-violet-border);
  color: var(--color-primary);
}

.status-badge.tone-success {
  background-color: var(--color-success-bg);
  border-color: var(--color-success-border);
  color: var(--color-success);
}

.status-badge.tone-warning {
  background-color: var(--color-warning-bg);
  border-color: var(--color-warning-border);
  color: var(--color-warning);
}

.status-badge.tone-danger {
  background-color: var(--color-danger-bg);
  border-color: var(--color-danger-border);
  color: var(--color-danger);
}

.status-badge.tone-neutral {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-border);
  color: var(--color-text-muted);
}

.surface-panel {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  padding: 1.4rem 1.5rem;
  box-shadow: var(--shadow-card);
  min-width: 0;
}

.state-panel,
.locked-panel {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.85rem;
}

.state-icon-box {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
}

.state-icon-box.tone-warning {
  background-color: var(--color-warning-bg);
  border-color: var(--color-warning-border);
  color: var(--color-warning);
}

.state-icon-box.tone-danger {
  background-color: var(--color-danger-bg);
  border-color: var(--color-danger-border);
  color: var(--color-danger);
}

.state-icon-box.tone-neutral {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-border);
  color: var(--color-text-muted);
}

.panel-heading,
.section-heading {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--color-text-main);
  line-height: 1.25;
}

.panel-copy {
  margin: 0;
  font-size: 0.94rem;
  color: var(--color-text-main);
  line-height: 1.55;
  max-width: 68ch;
}

.panel-copy.muted {
  color: var(--color-text-muted);
}

.info-callout {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  width: 100%;
  padding: 0.9rem 1rem;
  border-radius: 10px;
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  font-size: 0.88rem;
  color: var(--color-text-main);
  line-height: 1.5;
}

.callout-icon {
  color: var(--color-primary);
  margin-top: 2px;
}

.panel-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 0.35rem;
}

/* Shared Buttons aligned with portal tokens */
.btn-primary,
.btn-outline,
.btn-subtle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 44px;
  padding: 0.55rem 1.15rem;
  border-radius: 10px;
  font-family: var(--font-sans);
  font-size: 0.9rem;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease,
    transform 0.16s ease,
    box-shadow 0.16s ease;
}

.btn-primary {
  background: var(--btn-gradient);
  color: #ffffff;
  border: 1px solid var(--color-primary);
  box-shadow: var(--shadow-purple-sm);
}

.btn-primary:hover:not(:disabled) {
  background: var(--btn-gradient-hover);
  transform: translateY(-1px);
}

.btn-primary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.btn-outline {
  background-color: var(--color-card);
  color: var(--color-primary);
  border: 1px solid var(--color-border-control);
}

.btn-outline:hover:not(:disabled) {
  background-color: var(--color-bg-subtle);
  border-color: var(--color-primary);
}

.btn-outline:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-subtle {
  background-color: var(--color-bg-subtle);
  color: var(--color-text-main);
  border: 1px solid var(--color-border);
}

.btn-subtle:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

/* Introduction Layout */
.intro-panel {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.intro-top {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.rules-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
  margin: 0;
}

.rule-item {
  display: flex;
  flex-direction: column;
  gap: 0.28rem;
  padding: 0.9rem 1rem;
  border-radius: 10px;
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border-subtle);
}

.rule-label {
  font-size: 0.76rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

.rule-value {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text-main);
}

.rule-detail {
  margin: 0;
  font-size: 0.84rem;
  color: var(--color-text-muted);
  line-height: 1.45;
}

.categories-strip,
.previous-scores-strip {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding-top: 0.85rem;
  border-top: 1px solid var(--color-border-subtle);
}

.strip-heading-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.strip-label {
  font-size: 0.84rem;
  font-weight: 600;
  color: var(--color-text-main);
}

.local-note {
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

.category-chips {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.cat-chip {
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--color-text-main);
}

.score-trio {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.7rem;
}

.score-pill-box {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.7rem 0.85rem;
  border-radius: 10px;
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
}

.trio-label {
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.trio-value {
  font-family: var(--font-sans);
  font-size: 0.94rem;
  font-weight: 700;
  color: var(--color-text-main);
  font-variant-numeric: tabular-nums;
}

/* Quiz Workspace */
.quiz-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 270px;
  gap: 1.25rem;
  align-items: start;
}

.quiz-main {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.quiz-progress-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
}

.quiz-meta-left {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.question-counter {
  font-family: var(--font-display);
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--color-text-main);
}

.threat-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.18rem 0.6rem;
  border-radius: 999px;
  background-color: var(--color-violet-subtle);
  border: 1px solid var(--color-violet-border);
  color: var(--color-primary);
  font-size: 0.78rem;
  font-weight: 600;
}

.threat-pill.small {
  font-size: 0.74rem;
  padding: 0.14rem 0.5rem;
}

.answered-tally {
  font-family: var(--font-sans);
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.quiz-progress-track {
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background-color: var(--color-bg-muted);
  overflow: hidden;
}

.quiz-progress-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--btn-gradient);
  transition: width 0.25s cubic-bezier(0.22, 1, 0.36, 1);
}

.quiz-fieldset {
  border: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.quiz-question-text {
  padding: 0;
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.12rem;
  font-weight: 600;
  line-height: 1.48;
  color: var(--color-text-main);
  max-width: 68ch;
  overflow-wrap: break-word;
}

.choices-list {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.choice-option {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.8rem;
  min-height: 52px;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  background-color: var(--color-bg-subtle);
  border: 1.5px solid var(--color-border);
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.choice-option:hover {
  border-color: var(--color-primary);
  background-color: var(--color-card);
}

.choice-option:focus-within {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.choice-option.is-selected {
  background-color: var(--color-violet-subtle);
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-primary) 22%, transparent);
}

.choice-radio-input {
  width: 18px;
  height: 18px;
  accent-color: var(--color-primary);
  flex-shrink: 0;
  margin: 0;
  cursor: pointer;
}

.choice-letter {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  font-family: var(--font-display);
  font-size: 0.78rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.choice-option.is-selected .choice-letter {
  background: var(--btn-gradient);
  border-color: var(--color-primary);
  color: #ffffff;
}

.choice-text {
  font-size: 0.94rem;
  color: var(--color-text-main);
  line-height: 1.45;
  overflow-wrap: break-word;
  min-width: 0;
}

.quiz-actions-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding-top: 0.85rem;
  border-top: 1px solid var(--color-border-subtle);
}

.quiz-right-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.6rem;
}

/* Navigator Panel */
.navigator-panel {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.navigator-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.navigator-title {
  margin: 0;
  font-size: 0.98rem;
  font-weight: 700;
  color: var(--color-text-main);
}

.navigator-count {
  font-family: var(--font-sans);
  font-size: 0.78rem;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.navigator-legend {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.7rem;
  font-size: 0.74rem;
  color: var(--color-text-muted);
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.dot {
  width: 9px;
  height: 9px;
  border-radius: 3px;
  display: inline-block;
}

.dot-current {
  border: 2px solid var(--color-primary);
  background-color: var(--color-card);
}

.dot-answered {
  background: var(--btn-gradient);
}

.dot-empty {
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
}

.navigator-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.4rem;
}

.nav-pip {
  min-height: 40px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background-color: var(--color-bg-subtle);
  color: var(--color-text-main);
  font-family: var(--font-sans);
  font-size: 0.8rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition:
    background-color 0.14s ease,
    border-color 0.14s ease,
    color 0.14s ease;
}

.nav-pip.is-answered {
  background: var(--btn-gradient);
  border-color: var(--color-primary);
  color: #ffffff;
}

.nav-pip.is-current {
  box-shadow: 0 0 0 2px var(--color-card), 0 0 0 4px var(--color-primary);
  border-color: var(--color-primary);
}

.nav-pip:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.navigator-review-btn {
  width: 100%;
}

/* Review Step */
.review-panel {
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

.review-warning-banner {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem 1.1rem;
  border-radius: 12px;
  background-color: var(--color-warning-bg);
  border: 1px solid var(--color-warning-border);
  color: var(--color-text-main);
}

.banner-row {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
}

.warning-icon {
  color: var(--color-warning);
  margin-top: 2px;
}

.warning-sub {
  margin: 0.2rem 0 0;
  font-size: 0.86rem;
  color: var(--color-text-muted);
}

.unanswered-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.unanswered-chip {
  min-height: 36px;
  padding: 0.25rem 0.65rem;
  border-radius: 8px;
  border: 1px solid var(--color-warning-border);
  background-color: var(--color-card);
  color: var(--color-text-main);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}

.unanswered-chip:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.review-ready-banner {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.9rem 1.05rem;
  border-radius: 12px;
  background-color: var(--color-success-bg);
  border: 1px solid var(--color-success-border);
  color: var(--color-success);
  font-size: 0.9rem;
  font-weight: 600;
}

.review-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
}

.review-row-btn {
  display: grid;
  grid-template-columns: auto auto 1fr;
  grid-template-areas:
    'num cat pill'
    'snippet snippet snippet';
  align-items: center;
  gap: 0.35rem 0.55rem;
  padding: 0.7rem 0.85rem;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background-color: var(--color-bg-subtle);
  text-align: left;
  cursor: pointer;
  min-height: 60px;
}

.review-row-btn:hover {
  border-color: var(--color-primary);
  background-color: var(--color-card);
}

.review-row-btn.is-unanswered {
  border-color: var(--color-warning-border);
  background-color: var(--color-warning-bg);
}

.review-num {
  grid-area: num;
  font-family: var(--font-sans);
  font-size: 0.8rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-main);
}

.review-cat {
  grid-area: cat;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-primary);
}

.review-status-pill {
  grid-area: pill;
  justify-self: end;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.12rem 0.5rem;
  border-radius: 999px;
  background-color: var(--color-success-bg);
  color: var(--color-success);
  border: 1px solid var(--color-success-border);
}

.review-status-pill.is-missing {
  background-color: var(--color-card);
  color: var(--color-warning);
  border-color: var(--color-warning-border);
}

.review-answer-snippet {
  grid-area: snippet;
  font-size: 0.82rem;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.review-footer-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-border-subtle);
}

/* Results Screen */
.results-layout {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.mock-notice-banner {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.8rem 1rem;
  border-radius: 10px;
  background-color: var(--color-violet-subtle);
  border: 1px solid var(--color-violet-border);
  color: var(--color-text-main);
  font-size: 0.85rem;
  line-height: 1.45;
}

.result-hero {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.result-hero.is-passed {
  border-color: var(--color-success-border);
}

.result-hero.is-failed {
  border-color: var(--color-danger-border);
}

.result-hero-main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
}

.result-score-block {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.result-outcome-pill,
.exp-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  width: fit-content;
  padding: 0.22rem 0.68rem;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 700;
  border: 1px solid transparent;
}

.result-outcome-pill.is-pass,
.exp-badge.is-pass {
  background-color: var(--color-success-bg);
  border-color: var(--color-success-border);
  color: var(--color-success);
}

.result-outcome-pill.is-fail,
.exp-badge.is-fail {
  background-color: var(--color-danger-bg);
  border-color: var(--color-danger-border);
  color: var(--color-danger);
}

.result-score-display {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(1.75rem, 3vw, 2.25rem);
  font-weight: 800;
  color: var(--color-text-main);
  font-variant-numeric: tabular-nums;
}

.result-percent {
  font-size: 0.72em;
  font-weight: 600;
  color: var(--color-text-muted);
}

.result-hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
}

.breakdown-panel,
.explanations-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.breakdown-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem 1rem;
}

.breakdown-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.6rem 0.85rem;
  border-radius: 10px;
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border-subtle);
  font-size: 0.88rem;
}

.breakdown-name {
  font-weight: 600;
  color: var(--color-text-main);
}

.breakdown-score {
  font-family: var(--font-sans);
  font-weight: 700;
  color: var(--color-primary);
  font-variant-numeric: tabular-nums;
}

.breakdown-pct {
  color: var(--color-text-muted);
  font-weight: 500;
}

.explanations-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.85rem;
}

.segmented-filter {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  padding: 0.25rem;
  border-radius: 10px;
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
}

.filter-pill {
  min-height: 36px;
  padding: 0.3rem 0.75rem;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-family: var(--font-sans);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
}

.filter-pill.is-active {
  background: var(--btn-gradient);
  color: #ffffff;
}

.explanations-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.explanation-item {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 1rem 1.05rem;
  border-radius: 12px;
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
}

.explanation-item.is-item-correct {
  border-color: var(--color-success-border);
}

.explanation-item.is-item-incorrect {
  border-color: var(--color-danger-border);
}

.explanation-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.explanation-left-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.exp-num {
  font-family: var(--font-sans);
  font-size: 0.8rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-muted);
}

.exp-question {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text-main);
  line-height: 1.45;
  overflow-wrap: break-word;
}

.exp-answers {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.88rem;
  color: var(--color-text-main);
  line-height: 1.45;
}

.exp-answer-line,
.exp-rationale {
  margin: 0;
}

.exp-label {
  font-weight: 700;
  margin-right: 0.35rem;
  color: var(--color-text-muted);
}

.exp-answer-line.is-best {
  color: var(--color-success);
}

.exp-answer-line.is-best .exp-label {
  color: var(--color-success);
}

.empty-filter-note {
  padding: 1.25rem;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.error-surface {
  border-color: var(--color-danger-border);
}

@media (max-width: 960px) {
  .quiz-workspace {
    grid-template-columns: 1fr;
  }

  .rules-grid,
  .review-grid,
  .breakdown-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .page-header,
  .surface-panel {
    padding: 1.05rem;
  }

  .back-link,
  .start-btn,
  .retake-btn,
  .submit-btn {
    width: 100%;
  }

  .nav-pip {
    min-height: 44px;
  }

  .unanswered-chip {
    min-height: 44px;
  }

  .quiz-actions-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .quiz-right-actions {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .filter-pill {
    min-height: 44px;
    flex: 1 1 auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .btn-primary,
  .btn-outline,
  .choice-option,
  .quiz-progress-fill,
  .nav-pip {
    transition: none;
  }
}

:global(:root[data-reduced-motion='true']) .btn-primary,
:global(:root[data-reduced-motion='true']) .btn-outline,
:global(:root[data-reduced-motion='true']) .choice-option,
:global(:root[data-reduced-motion='true']) .quiz-progress-fill,
:global(:root[data-reduced-motion='true']) .nav-pip {
  transition: none;
}
</style>
