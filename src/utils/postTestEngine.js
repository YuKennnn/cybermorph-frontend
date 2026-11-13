export const CANONICAL_THREAT_CATEGORIES_ORDER = Object.freeze([
  'Phishing',
  'Smishing',
  'Vishing',
  'Social Engineering',
  'Credential Theft',
  'Public Wi-Fi Attack',
  'Malware Infection',
  'Ransomware',
])

export const POST_TEST_CONFIG = Object.freeze({
  totalQuestions: 40,
  basePerCategory: 5,
  extraCategoryCount: 0,
  categoryCount: CANONICAL_THREAT_CATEGORIES_ORDER.length,
  passPercentRequired: 75,
  minCorrectToPass: 30,
  timeLimitMinutes: null,
  unlimitedRetakes: true,
})

/**
 * Returns a new shallow-shuffled array using Fisher-Yates without mutating input.
 *
 * @template T
 * @param {readonly T[]} items
 * @param {() => number} [rng]
 * @returns {T[]}
 */
export const shuffleArray = (items, rng = Math.random) => {
  const result = Array.isArray(items) ? [...items] : []
  for (let i = result.length - 1; i > 0; i--) {
    const raw = Number(rng())
    const bounded = Number.isFinite(raw) ? Math.min(0.999999999999, Math.max(0, raw)) : 0
    const j = Math.floor(bounded * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * Extracts normalized unique scenario keys (`file:scenario_id`) from a bank question.
 * Used during sampling to minimize duplicate underlying scenarios in one attempt.
 *
 * @param {unknown} question
 * @returns {string[]}
 */
export const getScenarioKeys = (question) => {
  if (!question || typeof question !== 'object' || !Array.isArray(question.source_refs)) {
    return []
  }
  const keys = new Set()
  for (const ref of question.source_refs) {
    if (!ref || typeof ref !== 'object') continue
    const file = typeof ref.file === 'string' ? ref.file.trim().toLowerCase() : ''
    const scenarioId = typeof ref.scenario_id === 'string' ? ref.scenario_id.trim() : ''
    if (scenarioId) {
      keys.add(`${file}:${scenarioId}`)
    }
  }
  return Array.from(keys)
}

/**
 * Strips reviewer/answer-key metadata and returns clean player-facing question shape
 * with shuffled choices while preserving stable choice IDs (`A`–`D`).
 *
 * @param {object} rawQuestion
 * @param {number} displayIndex
 * @param {() => number} [rng]
 */
export const toPlayerQuestion = (rawQuestion, displayIndex, rng = Math.random) => {
  const choices = Array.isArray(rawQuestion.choices) ? rawQuestion.choices : []
  const shuffledChoices = shuffleArray(choices, rng).map((choice) => ({
    id: String(choice.id),
    text: String(choice.text ?? ''),
  }))

  return {
    id: String(rawQuestion.id),
    bankNumber: typeof rawQuestion.number === 'number' ? rawQuestion.number : null,
    displayNumber: displayIndex + 1,
    threat_name: String(rawQuestion.threat_name),
    question: String(rawQuestion.question ?? ''),
    choices: shuffledChoices,
  }
}

/**
 * Selects exactly 30 unique questions for a Post-test attempt:
 * - 3 questions from each of the 8 canonical categories (24 total)
 * - 1 additional question from 6 randomly chosen categories (6 total)
 * Avoids duplicate underlying scenario IDs across the attempt whenever available.
 * Shuffles both final question order and each item's choice order while retaining stable IDs.
 *
 * @param {readonly object[]} questionBank
 * @param {() => number} [rng]
 * @returns {Array<{
 *   id: string,
 *   bankNumber: number | null,
 *   displayNumber: number,
 *   threat_name: string,
 *   question: string,
 *   choices: Array<{ id: string, text: string }>
 * }>}
 */
export const selectPostTestQuestions = (questionBank, rng = Math.random) => {
  if (!Array.isArray(questionBank) || questionBank.length < POST_TEST_CONFIG.totalQuestions) {
    throw new Error('Question bank does not contain enough items to build a 40-question test.')
  }

  const byCategory = new Map()
  for (const category of CANONICAL_THREAT_CATEGORIES_ORDER) {
    byCategory.set(category, [])
  }

  for (const item of questionBank) {
    if (!item || typeof item !== 'object') continue
    if (byCategory.has(item.threat_name)) {
      byCategory.get(item.threat_name).push(item)
    }
  }

  const extraCategories = new Set(
    shuffleArray(CANONICAL_THREAT_CATEGORIES_ORDER, rng).slice(
      0,
      POST_TEST_CONFIG.extraCategoryCount,
    ),
  )

  const usedQuestionIds = new Set()
  const usedScenarioKeys = new Set()
  const pickedRaw = []

  const takeFromPool = (pool, needed) => {
    const shuffledPool = shuffleArray(pool, rng)
    const chosen = []

    // First pass: prefer questions whose scenario IDs have not been used in this attempt
    for (const candidate of shuffledPool) {
      if (chosen.length >= needed) break
      if (usedQuestionIds.has(candidate.id)) continue
      const keys = getScenarioKeys(candidate)
      const overlapsScenario = keys.some((key) => usedScenarioKeys.has(key))
      if (!overlapsScenario) {
        chosen.push(candidate)
        usedQuestionIds.add(candidate.id)
        for (const key of keys) {
          usedScenarioKeys.add(key)
        }
      }
    }

    // Fallback pass only if a category has fewer distinct scenarios than requested
    if (chosen.length < needed) {
      for (const candidate of shuffledPool) {
        if (chosen.length >= needed) break
        if (usedQuestionIds.has(candidate.id)) continue
        chosen.push(candidate)
        usedQuestionIds.add(candidate.id)
        for (const key of getScenarioKeys(candidate)) {
          usedScenarioKeys.add(key)
        }
      }
    }

    return chosen
  }

  for (const category of CANONICAL_THREAT_CATEGORIES_ORDER) {
    const targetCount =
      POST_TEST_CONFIG.basePerCategory + (extraCategories.has(category) ? 1 : 0)
    const pool = byCategory.get(category) || []
    if (pool.length < targetCount) {
      throw new Error(
        `Category "${category}" has ${pool.length} questions, fewer than the required ${targetCount}.`,
      )
    }
    const chosen = takeFromPool(pool, targetCount)
    if (chosen.length < targetCount) {
      throw new Error(`Unable to sample ${targetCount} unique questions for "${category}".`)
    }
    pickedRaw.push(...chosen)
  }

  const shuffledAttemptQuestions = shuffleArray(pickedRaw, rng)
  return shuffledAttemptQuestions.map((rawQuestion, idx) =>
    toPlayerQuestion(rawQuestion, idx, rng),
  )
}

/**
 * Evaluates a score against the 75% (at least 23/30) pass requirement.
 * 22/30 (73.3%) fails; 23/30 (76.7%) passes.
 *
 * @param {number} correctCount
 * @param {number} [totalCount]
 */
export const evaluatePostTestScore = (
  correctCount,
  totalCount = POST_TEST_CONFIG.totalQuestions,
) => {
  const safeTotal = Number.isInteger(totalCount) && totalCount > 0
    ? totalCount
    : POST_TEST_CONFIG.totalQuestions
  const safeCorrect =
    typeof correctCount === 'number' && Number.isFinite(correctCount)
      ? Math.max(0, Math.min(safeTotal, Math.trunc(correctCount)))
      : 0
  const exactPercentage = (safeCorrect / safeTotal) * 100
  const percentage = Math.round(exactPercentage * 10) / 10
  const passed =
    safeTotal === POST_TEST_CONFIG.totalQuestions
      ? safeCorrect >= POST_TEST_CONFIG.minCorrectToPass &&
        exactPercentage >= POST_TEST_CONFIG.passPercentRequired
      : exactPercentage >= POST_TEST_CONFIG.passPercentRequired

  return {
    correctCount: safeCorrect,
    totalCount: safeTotal,
    percentage,
    exactPercentage,
    passed,
  }
}

/**
 * Aggregates reviewed items into the 8 canonical threat categories in project order.
 *
 * @param {readonly object[]} reviewedItems
 */
export const buildCategoryBreakdown = (reviewedItems) => {
  const statsMap = new Map()
  for (const category of CANONICAL_THREAT_CATEGORIES_ORDER) {
    statsMap.set(category, { threat_name: category, asked: 0, correct: 0 })
  }

  if (Array.isArray(reviewedItems)) {
    for (const item of reviewedItems) {
      if (!item || typeof item !== 'object') continue
      const entry = statsMap.get(item.threat_name)
      if (!entry) continue
      entry.asked += 1
      if (item.isCorrect) {
        entry.correct += 1
      }
    }
  }

  return Array.from(statsMap.values()).map((entry) => ({
    ...entry,
    percentage: entry.asked > 0 ? Math.round((entry.correct / entry.asked) * 100) : null,
  }))
}
