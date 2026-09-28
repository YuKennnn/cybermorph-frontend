import apiClient from './client'

/**
 * Fetch class-wide analytics summary for a classroom owned by the educator.
 * Endpoint: GET /analytics/classroom?code_id={codeId}
 *
 * Response shape:
 * {
 *   code_id: string,
 *   student_count: number,
 *   avg_map_progress: number,
 *   avg_best_score_by_map: Record<string, number>, // Unplayed maps are absent
 *   category_fail_rates: Record<string, number | null> // Unattempted categories are null
 * }
 */
export const fetchClassroomAnalytics = async (codeId) => {
  const response = await apiClient.get('/analytics/classroom', {
    params: { code_id: codeId },
  })
  return response.data
}

/**
 * Fetch individual player proficiency breakdown for a student enrolled in the educator's class.
 * Endpoint: GET /analytics/player?profile_id={profileId}
 *
 * Response shape:
 * {
 *   profile_id: string,
 *   wins: number,
 *   losses: number,
 *   avg_duration_seconds: number,
 *   best_score_by_map: Record<string, number>,
 *   category_breakdown: Record<string, number | null>,
 *   recent_sessions: Array<{
 *     session_id: string,
 *     map_name: string,
 *     duration_seconds: number,
 *     credits_earned: number,
 *     credits_lost: number,
 *     result: 'win' | 'lose' | 'timeout',
 *     played_at: string
 *   }>
 * }
 */
export const fetchPlayerAnalytics = async (profileId) => {
  const response = await apiClient.get('/analytics/player', {
    params: { profile_id: profileId },
  })
  return response.data
}

/**
 * Fetch individual session attack telemetry and threat events.
 * Endpoint: GET /analytics/session?session_id={sessionId}
 *
 * Response shape:
 * {
 *   session_id: string,
 *   profile_id: string,
 *   username: string,
 *   map_name: string,
 *   result: 'win' | 'lose' | 'timeout',
 *   threat_events: Array<{
 *     threat_type: string,
 *     player_action: string,
 *     is_correct: boolean,
 *     is_legitimate_item: boolean,
 *     credits_affected: number,
 *     logged_at: string
 *   }>
 * }
 */
export const fetchSessionAnalytics = async (sessionId) => {
  const response = await apiClient.get('/analytics/session', {
    params: { session_id: sessionId },
  })
  return response.data
}
