# Defensive API Contract Parsing & Schema Drift Resilience

## Context & Principles

In distributed client-server applications like CyberMorph (where the Vue 3 frontend connects to a FastAPI backend alongside a Godot game client), the backend contract is the authoritative source of truth.

Adhering to Rule 3 of `AGENTS.md` and ADR-006:
> *"Treat documented API contracts and the actual backend implementation as the source of truth; do not invent endpoints, request fields, response fields, or authentication behavior."*

Frontend code must not invent aliases (such as substituting `code` for `code_value`, or `score` for `total_score`). Instead, frontend components must consume the exact documented fields and handle data defensively against missing records, unattempted items, and network errors.

---

## Recommended Architecture & Best Practices

### 1. Robust Collection Handling
Endpoints return documented types (e.g. `GET /classroom/my-codes` returns a flat array of `ClassroomResponse`, while paginated endpoints return `{ items, total_count, page, page_size }`). Ensure data-fetching actions guard against unexpected nulls:

```javascript
// Recommended pattern for collection endpoints
const fetchClassrooms = async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const data = await fetchMyClassrooms()
    classrooms.value = Array.isArray(data) ? data : []
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Failed to retrieve classrooms.')
  } finally {
    isLoading.value = false
  }
}
```

### 2. Strict Key Binding with Safe Numerical Defaults
Use the exact documented backend keys (`code_value`, `code_id`, `total_score`). When formatting numbers that could be undefined or null in early states, use nullish coalescing:

```vue
<!-- In classroom cards or tables -->
<div class="code-badge">
  Class code: {{ classroom.code_value }}
</div>

<button @click="$emit('inspect', classroom.code_id)">
  View students
</button>
```

For numerical formatting:
```vue
<!-- Safe numerical formatting with documented key -->
<span class="score-value">
  {{ (entry.total_score ?? 0).toLocaleString() }} PTS
</span>
```

### 3. Preserving Semantic `null` Values
Distinguish between "no data yet" and "zero":

```vue
<!-- In EducatorAnalyticsView.vue -->
<div v-for="threat in CANONICAL_THREATS" :key="threat.name" class="threat-metric">
  <span class="threat-name">{{ threat.name }}</span>
  
  <!-- Explicit check: null means unattempted, not 0% fail rate -->
  <span v-if="analytics?.category_fail_rates?.[threat.name] !== null && analytics?.category_fail_rates?.[threat.name] !== undefined">
    {{ Math.round(analytics.category_fail_rates[threat.name] * 100) }}% fail rate
  </span>
  <span v-else class="text-muted">
    No attempts recorded yet
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

  // Flat detail string (401, 403, 404, 500)
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

1. Run non-fixing linting:
   ```powershell
   npx oxlint .
   npx eslint .
   ```
2. Verify that views render empty states cleanly when lists are empty (`[]`).
3. Verify that unattempted categories in analytics render "No attempts recorded yet" instead of "0%".
4. Verify that nested 409 conflict errors display friendly, human-readable text instead of `[object Object]`.
