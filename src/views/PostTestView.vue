<script setup>
import { computed, defineAsyncComponent, onMounted, watch } from 'vue'
import { useAuthStore } from '../stores/authStore.js'
import { usePostTestStore } from '../stores/postTestStore.js'
import { POST_TEST_CONFIG } from '../utils/postTestEngine.js'
import AppIcon from '../components/common/AppIcon.vue'

// Compiled out completely during production `vite build` when DEV is false
const PostTestDevPreviewBar =
  import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === 'true'
    ? defineAsyncComponent(() => import('../components/postTest/PostTestDevPreviewBar.vue'))
    : null

const authStore = useAuthStore()
const postTestStore = usePostTestStore()

const CHOICE_SLOT_LETTERS = Object.freeze(['A', 'B', 'C', 'D'])

const activeAttempt = computed(() => postTestStore.currentAttempt)
const activeQuestion = computed(() => postTestStore.currentQuestion)
const result = computed(() => postTestStore.activeResult)
const bestAttempt = computed(() => postTestStore.bestAttempt)

const orderedAttemptHistory = computed(() => {
  const list = Array.isArray(postTestStore.attemptHistory) ? postTestStore.attemptHistory : []
  return [...list].sort((a, b) => {
    const timeA = a?.submittedAt ? Date.parse(a.submittedAt) : 0
    const timeB = b?.submittedAt ? Date.parse(b.submittedAt) : 0
    if (Number.isFinite(timeA) && Number.isFinite(timeB) && timeA !== timeB) {
      return timeB - timeA
    }
    return 0
  })
})

const latestAttempt = computed(() => orderedAttemptHistory.value[0] || null)

const showBestVsLatest = computed(() => {
  if (orderedAttemptHistory.value.length <= 1 || !bestAttempt.value || !latestAttempt.value) {
    return false
  }
  return (
    bestAttempt.value.attemptId !== latestAttempt.value.attemptId &&
    (bestAttempt.value.correctCount !== latestAttempt.value.correctCount ||
      bestAttempt.value.scorePercent !== latestAttempt.value.scorePercent)
  )
})

const primaryStartLabel = computed(() => {
  if (postTestStore.isStarting) return 'Preparing questions...'
  if (postTestStore.currentAttempt) return 'Continue post-test'
  if (orderedAttemptHistory.value.length > 0) return 'Retake post-test'
  return 'Start post-test'
})

const attemptTotal = computed(
  () => activeAttempt.value?.questionCount || POST_TEST_CONFIG.totalQuestions,
)

const passMarkPercent = computed(
  () => result.value?.passMarkPercent ?? activeAttempt.value?.passMarkPercent ?? 75,
)

const minCorrectForPass = computed(() =>
  Math.ceil((attemptTotal.value * passMarkPercent.value) / 100),
)

const minCorrectForResult = computed(() => {
  if (!result.value) return minCorrectForPass.value
  return Math.ceil((result.value.questionCount * result.value.passMarkPercent) / 100)
})

const selectedOptionId = computed(() => {
  if (!activeAttempt.value || !activeQuestion.value) return null
  return activeAttempt.value.answers?.[activeQuestion.value.id] || null
})

const quizProgressPercent = computed(() => {
  return Math.min(100, Math.round((postTestStore.answeredCount / attemptTotal.value) * 100))
})

const isLastQuestion = computed(() => {
  if (!activeAttempt.value) return false
  return activeAttempt.value.currentIndex >= activeAttempt.value.questions.length - 1
})

const statusBadge = computed(() => {
  const current = postTestStore.status
  if (current === 'loading' || current === 'idle') return { label: 'Loading', tone: 'neutral' }
  if (current === 'error') return { label: 'Error', tone: 'danger' }
  if (current === 'locked') return { label: 'Locked', tone: 'warning' }
  if (current === 'in-progress') {
    return {
      label: `In progress · ${postTestStore.answeredCount}/${attemptTotal.value}`,
      tone: 'primary',
    }
  }
  if (current === 'review') {
    return { label: 'Reviewing answers', tone: 'primary' }
  }
  if (current === 'results' && result.value) {
    return result.value.passed
      ? { label: 'Passed', tone: 'success' }
      : { label: 'Not passed', tone: 'danger' }
  }
  if (current === 'available' && postTestStore.overallPassed) {
    return { label: 'Passed', tone: 'success' }
  }
  return { label: 'Available', tone: 'primary' }
})

const formatAttemptRatio = (entry) => {
  if (!entry) return '—'
  return `${entry.correctCount}/${entry.questionCount} (${entry.scorePercent}%)`
}

const formatSubmittedDate = (isoString) => {
  if (!isoString) return 'Recently submitted'
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return 'Recently submitted'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

const getAnswerPreviewText = (question) => {
  if (!activeAttempt.value || !question) return 'Not answered'
  const selectedId = activeAttempt.value.answers?.[question.id]
  if (!selectedId) return 'Not answered'
  const match = (question.options || []).find((opt) => opt.id === selectedId)
  return match ? match.text : 'Answered'
}

const handleSelectAnswer = (questionId, optionId) => {
  postTestStore.selectAnswer(questionId, optionId)
}

const handleStart = async () => {
  await postTestStore.startAttempt()
}

const handleSubmit = async () => {
  await postTestStore.submitAttempt()
}

const handleRetake = async () => {
  await postTestStore.retakeAttempt()
}

watch(
  () => `${authStore.activeSessionEpoch}::${authStore.token || ''}`,
  (nextScope, prevScope) => {
    if (nextScope === prevScope) return
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
            {{ attemptTotal }}-question cybersecurity knowledge check covering all eight CyberMorph threat categories.
          </p>
        </div>
      </div>

      <router-link to="/dashboard" class="btn-outline back-link">
        <AppIcon name="arrow-left" :size="15" />
        <span>Back to overview</span>
      </router-link>
    </header>

    <!-- Loading State -->
    <section
      v-if="postTestStore.status === 'loading' || postTestStore.status === 'idle'"
      class="surface-panel state-panel"
      role="status"
      aria-live="polite"
    >
      <div class="spinner" aria-hidden="true"></div>
      <h2 class="panel-heading">Checking post-test readiness...</h2>
      <p class="panel-copy muted">Loading your eligibility and submitted post-test history.</p>
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
      <h2 id="locked-heading" class="panel-heading">Win and sync Public Park to unlock the post-test</h2>
      <p class="panel-copy">
        Eligibility requires completing and <strong>winning a Public Park game session</strong> in CyberMorph
        and syncing that result to the server.
      </p>

      <div class="info-callout" role="note">
        <AppIcon name="info" :size="16" class="callout-icon" />
        <div class="callout-text">
          Unlocking the Public Park map alone is not enough to open the post-test. Finish a Public Park
          session with a win while signed in (or sync your offline session) so the server records your
          eligibility.
        </div>
      </div>

      <div class="panel-actions">
        <button
          type="button"
          class="btn-primary start-btn"
          disabled
          aria-disabled="true"
        >
          <span>Start post-test</span>
          <AppIcon name="arrow-right" :size="15" />
        </button>
      </div>
    </section>

    <!-- Introduction View -->
    <section
      v-else-if="postTestStore.status === 'available'"
      class="surface-panel intro-panel"
      aria-labelledby="intro-heading"
    >
      <div class="intro-hero-row">
        <div class="intro-summary-col">
          <h2 id="intro-heading" class="intro-summary-line">
            {{ attemptTotal }} questions · {{ passMarkPercent }}% to pass ({{ minCorrectForPass }}/{{ attemptTotal }}) · Unlimited retakes
          </h2>
          <p class="intro-instruction">Choose one answer per question.</p>
        </div>

        <div class="intro-cta-col">
          <button
            type="button"
            class="btn-primary start-btn intro-primary-btn"
            :disabled="postTestStore.isStarting"
            @click="handleStart"
          >
            <span>{{ primaryStartLabel }}</span>
            <AppIcon name="arrow-right" :size="15" />
          </button>
        </div>
      </div>

      <div v-if="postTestStore.inlineActionError" class="inline-alert-banner" role="alert">
        <AppIcon name="warning" :size="16" />
        <span>{{ postTestStore.inlineActionError }}</span>
      </div>

      <div v-if="postTestStore.historyWarning" class="info-callout" role="status">
        <AppIcon name="info" :size="16" class="callout-icon" />
        <div class="callout-text">{{ postTestStore.historyWarning }}</div>
      </div>

      <section
        v-if="orderedAttemptHistory.length > 0"
        class="previous-scores-strip"
        aria-labelledby="history-heading"
      >
        <div class="strip-heading-row">
          <h3 id="history-heading" class="strip-label">
            Submitted attempts ({{ orderedAttemptHistory.length }})
          </h3>
          <span
            class="status-badge"
            :class="postTestStore.overallPassed ? 'tone-success' : 'tone-neutral'"
          >
            {{ postTestStore.overallPassed ? 'Overall passed' : 'Not passed yet' }}
          </span>
        </div>

        <div v-if="showBestVsLatest" class="best-latest-strip">
          <div class="best-latest-item">
            <span class="trio-label">Best score</span>
            <strong class="trio-value">{{ formatAttemptRatio(bestAttempt) }}</strong>
          </div>
          <div class="best-latest-item">
            <span class="trio-label">Latest attempt</span>
            <strong class="trio-value">{{ formatAttemptRatio(latestAttempt) }}</strong>
          </div>
        </div>

        <ul class="attempt-history-list" aria-label="Submitted post-test attempts">
          <li
            v-for="attempt in orderedAttemptHistory"
            :key="attempt.attemptId"
            class="attempt-history-row"
          >
            <div class="attempt-history-meta">
              <span class="attempt-history-date">{{ formatSubmittedDate(attempt.submittedAt) }}</span>
              <span class="attempt-history-score">{{ formatAttemptRatio(attempt) }}</span>
            </div>
            <div class="attempt-history-actions">
              <span class="result-outcome-pill" :class="attempt.passed ? 'is-pass' : 'is-fail'">
                {{ attempt.passed ? 'Passed' : 'Not passed' }}
              </span>
              <button
                type="button"
                class="btn-outline attempt-view-btn"
                :disabled="postTestStore.isLoadingResult"
                @click="postTestStore.viewAttemptResult(attempt.attemptId)"
              >
                View result
              </button>
            </div>
          </li>
        </ul>
      </section>
    </section>

    <!-- Quiz Screen (One Question at a Time) -->
    <div
      v-else-if="postTestStore.status === 'in-progress' && activeAttempt && activeQuestion"
      class="quiz-workspace"
    >
      <section class="surface-panel quiz-main" aria-labelledby="quiz-question-heading">
        <div v-if="activeAttempt.resumed" class="info-callout resume-notice-banner" role="status">
          <AppIcon name="info" :size="16" class="callout-icon" />
          <div class="callout-text">
            Resumed your open attempt with the same {{ activeAttempt.questionCount }} questions. Answer
            selections are kept in memory only, so please confirm your picks before submitting.
          </div>
        </div>

        <div class="quiz-progress-header">
          <div class="quiz-meta-left">
            <span class="question-counter">
              Question {{ activeQuestion.displayNumber }} of {{ activeAttempt.questionCount }}
            </span>
            <span class="threat-pill">{{ activeQuestion.topic }}</span>
          </div>
          <span class="answered-tally">
            {{ postTestStore.answeredCount }} of {{ activeAttempt.questionCount }} answered
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
            {{ activeQuestion.questionText }}
          </legend>

          <div class="choices-list" role="radiogroup" :aria-labelledby="'quiz-question-heading'">
            <label
              v-for="(option, idx) in activeQuestion.options"
              :key="option.id"
              class="choice-option"
              :class="{ 'is-selected': selectedOptionId === option.id }"
              :data-option-id="option.id"
            >
              <input
                type="radio"
                class="choice-radio-input"
                :name="`post-test-q-${activeQuestion.id}`"
                :value="option.id"
                :checked="selectedOptionId === option.id"
                @change="handleSelectAnswer(activeQuestion.id, option.id)"
              />
              <span class="choice-letter" aria-hidden="true">{{ CHOICE_SLOT_LETTERS[idx] || '?' }}</span>
              <span class="choice-text">{{ option.text }}</span>
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
              Review ({{ postTestStore.answeredCount }}/{{ activeAttempt.questionCount }})
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
          <span class="navigator-count">
            {{ postTestStore.answeredCount }}/{{ activeAttempt.questionCount }} answered
          </span>
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
            {{ postTestStore.answeredCount }} of {{ activeAttempt.questionCount }} answered.
            Passing requires at least {{ minCorrectForPass }}/{{ activeAttempt.questionCount }} correct
            answers ({{ activeAttempt.passMarkPercent }}%).
          </p>
        </div>
      </div>

      <div v-if="postTestStore.inlineActionError" class="inline-alert-banner" role="alert">
        <AppIcon name="warning" :size="16" />
        <span>{{ postTestStore.inlineActionError }}</span>
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
              Every question must be answered before you can submit. Select a question number below
              to return and choose an answer.
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
        <span>
          All {{ activeAttempt.questionCount }} questions have a selected answer. Ready to submit when you are.
        </span>
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
          <span class="review-cat">{{ q.topic }}</span>
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
          :disabled="postTestStore.isSubmitting || !postTestStore.allQuestionsAnswered || !postTestStore.isActionSupported"
          @click="handleSubmit"
        >
          <AppIcon name="check" :size="15" />
          <span>
            {{
              postTestStore.isSubmitting
                ? 'Submitting answers...'
                : !postTestStore.allQuestionsAnswered
                  ? `Answer all ${activeAttempt.questionCount} questions to submit`
                  : 'Submit post-test'
            }}
          </span>
        </button>
      </div>
    </section>

    <!-- Results Screen -->
    <div v-else-if="postTestStore.status === 'results' && result" class="results-layout">
      <div v-if="postTestStore.inlineActionError" class="inline-alert-banner" role="alert">
        <AppIcon name="warning" :size="16" />
        <span>{{ postTestStore.inlineActionError }}</span>
      </div>

      <div v-if="postTestStore.historyWarning" class="info-callout" role="status">
        <AppIcon name="info" :size="16" class="callout-icon" />
        <div class="callout-text">{{ postTestStore.historyWarning }}</div>
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
              {{ result.correctCount }} / {{ result.questionCount }}
              <span class="result-percent">({{ result.scorePercent }}%)</span>
            </h2>
            <p class="panel-copy">
              <template v-if="result.passed">
                You met the {{ result.passMarkPercent }}% passing requirement (at least
                {{ minCorrectForResult }}/{{ result.questionCount }} correct answers).
              </template>
              <template v-else-if="postTestStore.overallPassed">
                This attempt scored below the {{ result.passMarkPercent }}% pass mark, but your earlier
                passing status and best score remain preserved.
              </template>
              <template v-else>
                Passing requires at least {{ minCorrectForResult }}/{{ result.questionCount }} correct
                answers ({{ result.passMarkPercent }}%). Review your topic breakdown below and retake whenever you are ready.
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
            <button type="button" class="btn-outline" @click="postTestStore.backToOverview">
              Attempt history
            </button>
            <router-link to="/threat-index" class="btn-outline">Review threat index</router-link>
          </div>
        </div>

        <div class="score-trio results-trio" aria-label="Post-test summary">
          <div class="score-pill-box">
            <span class="trio-label">Overall status</span>
            <strong class="trio-value">{{ postTestStore.overallPassed ? 'Passed' : 'Not passed yet' }}</strong>
          </div>
          <div class="score-pill-box">
            <span class="trio-label">Best score</span>
            <strong class="trio-value">{{ formatAttemptRatio(bestAttempt) }}</strong>
          </div>
          <div class="score-pill-box">
            <span class="trio-label">Submitted attempts</span>
            <strong class="trio-value">{{ postTestStore.attemptHistory.length }}</strong>
          </div>
          <div class="score-pill-box">
            <span class="trio-label">Submitted</span>
            <strong class="trio-value">{{ formatSubmittedDate(result.submittedAt) }}</strong>
          </div>
        </div>
      </section>

      <!-- Topic Breakdown -->
      <section class="surface-panel breakdown-panel" aria-labelledby="breakdown-heading">
        <h2 id="breakdown-heading" class="section-heading">Results by threat category</h2>
        <div class="breakdown-grid">
          <div
            v-for="cat in result.topics"
            :key="cat.topic"
            class="breakdown-row breakdown-row-stacked"
          >
            <div class="breakdown-row-top">
              <span class="breakdown-name">{{ cat.topic }}</span>
              <span class="breakdown-score">
                {{ cat.correct }}/{{ cat.total }}
                <span class="breakdown-pct">({{ cat.percentage }}%)</span>
              </span>
            </div>
            <div class="topic-bar-track" aria-hidden="true">
              <div class="topic-bar-fill" :style="{ width: `${cat.percentage}%` }"></div>
            </div>
          </div>
        </div>
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

.intro-hero-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.25rem 2rem;
}

.intro-summary-col {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
}

.intro-summary-line {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.08rem;
  font-weight: 700;
  line-height: 1.35;
  color: var(--color-text-main);
  font-variant-numeric: tabular-nums;
}

.intro-instruction {
  margin: 0;
  font-size: 0.92rem;
  color: var(--color-text-muted);
  line-height: 1.45;
}

.intro-cta-col {
  flex-shrink: 0;
}

.intro-primary-btn {
  min-height: 46px;
  padding: 0.65rem 1.4rem;
  font-size: 0.95rem;
}

.previous-scores-strip {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-top: 1rem;
  border-top: 1px solid var(--color-border-subtle);
}

.strip-heading-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.strip-label {
  margin: 0;
  font-family: var(--font-display);
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--color-text-main);
}

.best-latest-strip {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
}

.best-latest-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  padding: 0.6rem 0.85rem;
  border-radius: 10px;
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border-subtle);
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

.inline-alert-banner {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  padding: 0.85rem 1rem;
  border-radius: 12px;
  border: 1px solid var(--color-danger-border);
  background-color: var(--color-danger-bg);
  color: var(--color-danger-text);
  font-size: 0.9rem;
  font-weight: 500;
  line-height: 1.45;
}

.resume-notice-banner {
  margin-bottom: 0.25rem;
}

.attempt-history-list {
  list-style: none;
  margin: 0.75rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.attempt-history-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.65rem 1rem;
  padding: 0.75rem 0.95rem;
  border-radius: 12px;
  border: 1px solid var(--color-border);
  background-color: var(--color-surface);
}

.attempt-history-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem 0.9rem;
  min-width: 0;
}

.attempt-history-date {
  font-size: 0.86rem;
  color: var(--color-text-muted);
}

.attempt-history-score {
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--color-text-main);
  font-variant-numeric: tabular-nums;
}

.attempt-history-actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.attempt-view-btn {
  padding: 0.35rem 0.75rem;
  font-size: 0.82rem;
  min-height: 36px;
}

.breakdown-row-stacked {
  flex-direction: column;
  align-items: stretch;
  gap: 0.5rem;
}

.breakdown-row-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.topic-bar-track {
  width: 100%;
  height: 7px;
  border-radius: 999px;
  background-color: var(--color-surface-muted);
  overflow: hidden;
}

.topic-bar-fill {
  height: 100%;
  border-radius: 999px;
  background-color: var(--color-primary);
  transition: width 220ms ease;
}

.error-surface {
  border-color: var(--color-danger-border);
}

@media (max-width: 960px) {
  .quiz-workspace {
    grid-template-columns: 1fr;
  }

  .review-grid,
  .breakdown-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .intro-hero-row {
    flex-direction: column;
    align-items: stretch;
  }

  .intro-cta-col {
    width: 100%;
  }

  .intro-primary-btn {
    width: 100%;
  }
}

@media (max-width: 640px) {
  .best-latest-strip {
    grid-template-columns: 1fr;
  }

  .attempt-view-btn {
    min-height: 44px;
  }
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
