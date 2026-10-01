# Defensive API Contract Parsing & Schema Drift Resilience

## Context & Problem Statement

In distributed client-server applications like CyberMorph (where the Vue 3 frontend connects to a FastAPI backend alongside a Godot game client), frontend and backend contracts inevitably evolve. During frontend integration, views and components frequently encounter subtle schema mismatches:

1. **Envelope Differences**:
   - The backend might return a direct JSON array (`[...]`), while legacy mock or stub code wraps it in an object (`{ classrooms: [...] }`).
   - Paginated endpoints use an envelope (`{ items: [...], total_count: 42, page: 1, page_size: 20 }`), while frontend views might search for `data.students` or `data.results`.
2. **Identifier & Field Key Drift**:
   - Backend database models often use prefixed identifier keys (`code_id`, `code_value`, `web_profile_id`), whereas initial UI mockups commonly assume simplified keys (`id`, `code`).
   - Leaderboard endpoints provide `total_score`, while local simulations might name the field `score`. Directly calling `.toLocaleString()` on an undefined property causes fatal runtime crashes.
3. **Semantic Ambiguity (`null` vs `0`)**:
   - In analytics endpoints (e.g. `GET /analytics/classroom`), an unattempted threat category yields `null`, whereas a category where all students succeeded yields `0.0`. Rendering `null` as "0%" provides misleading pedagogical feedback to educators.
4. **Nested Error Payloads**:
   - FastAPI errors are not always flat strings. A `409 Conflict` error returns `{ detail: { field: "email", message: "Email already registered" } }`, while `422 Unprocessable Entity` returns an array of validation errors.

---

## Recommended Architecture & Best Practices

### 1. Defensive List Normalization
Never assume a single shape for collection responses. Normalize incoming payloads immediately inside data-fetching actions:

```javascript
// Recommended pattern for collection endpoints
const fetchClassrooms = async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const data = await fetchMyClassrooms()
    // Supports both flat array [ ... ] and envelope { classrooms: [ ... ] } or { items: [ ... ] }
    classrooms.value = Array.isArray(data) ? data : data.classrooms || data.items || []
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Failed to retrieve classroom rosters.')
  } finally {
    isLoading.value = false
  }
}
```

### 2. Dual-Key Binding with Fallbacks
When binding keys in child components or template loops, safeguard against schema drift by checking the canonical backend key first, followed by fallbacks:

```vue
<!-- In ClassroomCard.vue or table rows -->
<div class="code-badge">
  CODE: {{ classroom.code_value || classroom.code || 'UNKNOWN' }}
</div>

<button @click="$emit('inspect', classroom.code_id || classroom.id)">
  View Telemetry
</button>
```

For numerical formatting, always use nullish coalescing before invoking number methods:
```vue
<!-- Safe numerical formatting -->
<span class="score-value">
  {{ (entry.total_score ?? entry.score ?? 0).toLocaleString() }} PTS
</span>
```

### 3. Preserving Semantic `null` Values
Distinguish between "no data yet" and "zero":

```vue
<!-- In EducatorAnalyticsView.vue -->
<div v-for="threat in CANONICAL_THREATS" :key="threat.name" class="threat-metric">
  <span class="threat-name">{{ threat.name }}</span>
  
  <!-- Explicit check: null is unattempted, not 0% -->
  <span v-if="analytics?.category_fail_rates?.[threat.name] !== null && analytics?.category_fail_rates?.[threat.name] !== undefined">
    {{ Math.round(analytics.category_fail_rates[threat.name] * 100) }}% Fail Rate
  </span>
  <span v-else class="text-muted">
    No Telemetry Yet
  </span>
</div>
```

### 4. Centralized Error Normalization
All API errors should pass through a shared extractor that unpacks string details, nested objects, and validation arrays:

```javascript
// src/api/client.js
export const extractErrorMessage = (error, defaultMessage = 'An unexpected error occurred.') => {
  if (!error) return defaultMessage

  if (!error.response) {
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return 'Connection timed out. The server may still be waking up — please try again.'
    }
    return error.message || 'Unable to connect to the backend server.'
  }

  const data = error.response.data
  if (!data) return defaultMessage

  // Flat detail string (401, 403, 404)
  if (typeof data.detail === 'string') {
    return data.detail
  }

  // Nested detail object (409 conflict: { detail: { field, message } })
  if (data.detail && typeof data.detail === 'object') {
    if (data.detail.message) {
      return data.detail.message
    }
    // Validation error array (422: [{ loc, msg, type }])
    if (Array.isArray(data.detail) && data.detail.length > 0) {
      return data.detail[0]?.msg || defaultMessage
    }
  }

  return defaultMessage
}
```

---

## Verification Steps

1. Test API calls with mock data and verify that views render correctly.
2. Switch `.env` to live backend (`VITE_USE_MOCK=false`) and confirm that missing or renamed keys do not cause uncaught `TypeError` exceptions.
3. Test edge-case states:
   - Empty classroom roster (`[]`).
   - Null analytics values (confirm "No Telemetry Yet" renders instead of "0%").
   - 409 duplicate registration (confirm user-friendly text renders instead of `[object Object]`).
