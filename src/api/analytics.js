import apiClient from './client'

/**
 * Fetch class-wide analytics summary for a classroom owned by the educator.
 * Endpoint: GET /analytics/classroom?code_id={codeId}
 *
 * Response shape (`AnalyticsClassroomResponse`):
 * {
 *   code_id: string,
 *   student_count: number,
 *   avg_map_progress: number | null, // null when classroom has 0 current students
 *   avg_best_score_by_map: Record<string, number>, // One stored best score per current student; unplayed maps absent
 *   category_fail_rates: Record<string, number | null> // Always 8 canonical keys; null when no uploaded decisions
 * }
 */
export const fetchClassroomAnalytics = async (codeId) => {
  const response = await apiClient.get('/analytics/classroom', {
    params: { code_id: codeId },
  })
  return response.data
}

/**
 * Fetch individual player proficiency breakdown for a student enrolled in any educator-owned classroom.
 * Endpoint: GET /analytics/player?profile_id={profileId}
 *
 * Does not include `username` or `last_synced_at`; read those from GET /classroom/{code_id}/students.
 *
 * Response shape (`AnalyticsPlayerResponse`):
 * {
 *   profile_id: string,
 *   map_progress: number,
 *   wins: number,
 *   losses: number, // All non-"win" runs ("lose", "timeout", missing result, goal-met runs without map unlock)
 *   avg_duration_seconds: number | null, // null when 0 uploaded runs
 *   best_score_by_map: Record<string, number>,
 *   category_breakdown: Record<string, number | null>, // Always 8 canonical keys; null when no uploaded decisions
 *   threat_index: Array<{
 *     threat_name: string,
 *     is_unlocked: boolean,
 *     unlocked_at: string | null
 *   }>,
 *   recent_sessions: Array<{
 *     session_id: string,
 *     profile_id: string,
 *     map_name: string,
 *     duration_seconds: number,
 *     credits_earned: number,
 *     credits_lost: number,
 *     credits_left: number | null,
 *     false_positives: number,
 *     result: 'win' | 'lose' | 'timeout' | null,
 *     is_synced: boolean,
 *     played_at: string,
 *     created_at: string
 *   }> // At most 10 entries, newest first
 * }
 */
export const fetchPlayerAnalytics = async (profileId) => {
  const response = await apiClient.get('/analytics/player', {
    params: { profile_id: profileId },
  })
  return response.data
}

/**
 * Fetch individual session attack telemetry and threat events for one of the educator's students.
 * Endpoint: GET /analytics/session?session_id={sessionId}
 *
 * Response shape (`AnalyticsSessionResponse`):
 * {
 *   session_id: string,
 *   profile_id: string,
 *   username: string,
 *   map_name: string,
 *   result: 'win' | 'lose' | 'timeout' | null,
 *   threat_events: Array<{
 *     attack_log_id: string,
 *     session_id: string,
 *     threat_type: string,
 *     player_action: string,
 *     is_correct: boolean,
 *     is_legitimate_item: boolean,
 *     scenario_difficulty: string | null,
 *     credits_affected: number,
 *     response_time_ms: number | null,
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
