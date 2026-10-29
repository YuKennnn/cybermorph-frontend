<script setup>
defineProps({
  sessions: {
    type: Array,
    default: () => [],
  },
  ariaLabelledby: {
    type: String,
    default: '',
  },
  ariaLabel: {
    type: String,
    default: '',
  },
})
</script>

<template>
  <div class="sessions-table-wrapper">
    <table
      class="sessions-table"
      :aria-labelledby="ariaLabelledby || undefined"
      :aria-label="!ariaLabelledby && ariaLabel ? ariaLabel : undefined"
    >
      <thead>
        <tr>
          <th scope="col">Date</th>
          <th scope="col">Map</th>
          <th scope="col">Result</th>
          <th scope="col" class="col-num">Score</th>
          <th scope="col">Credit breakdown</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="session in sessions" :key="session.session_id">
          <td data-label="Date" class="cell-date">
            <span class="date-primary">{{ session.played_date_label }}</span>
            <span class="date-duration">Duration: {{ session.duration_label }}</span>
          </td>
          <td data-label="Map">
            <span class="map-badge" :data-map="session.map_name">
              {{ session.map_name }}
            </span>
          </td>
          <td data-label="Result">
            <span class="result-pill" :data-result="session.result">
              {{ session.result_label }}
            </span>
          </td>
          <td
            data-label="Score"
            class="col-num cell-score"
            :class="{ 'is-unavailable': session.score === null }"
          >
            {{ session.score_label }}
          </td>
          <td
            data-label="Credit breakdown"
            class="cell-breakdown"
            :class="{ 'is-unavailable': session.score === null }"
          >
            {{ session.credit_breakdown_label }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.sessions-table-wrapper {
  width: 100%;
  overflow-x: auto;
}

.sessions-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.86rem;
}

.sessions-table th,
.sessions-table td {
  padding: 0.7rem 0.75rem;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
  vertical-align: middle;
}

.sessions-table th {
  font-size: 0.74rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  background-color: var(--color-bg-subtle);
}

.sessions-table th.col-num,
.sessions-table td.col-num {
  text-align: right;
}

.cell-date {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.date-primary {
  font-weight: 600;
  color: var(--color-text-main);
}

.date-duration {
  font-size: 0.75rem;
  color: var(--color-text-dim);
}

.map-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.18rem 0.55rem;
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: 600;
  background-color: var(--color-purple-light);
  color: var(--color-primary);
  border: 1px solid var(--color-border);
}

.result-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.16rem 0.55rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  border: 1px solid var(--color-border);
  background-color: var(--color-bg-subtle);
  color: var(--color-text-muted);
}

.result-pill[data-result='win'] {
  background-color: var(--color-success-bg);
  border-color: var(--color-success-border);
  color: var(--color-success);
}

.result-pill[data-result='lose'] {
  background-color: var(--color-danger-bg);
  border-color: var(--color-danger-border);
  color: var(--color-danger);
}

.result-pill[data-result='timeout'] {
  background-color: var(--color-purple-light);
  border-color: var(--color-border);
  color: var(--color-primary);
}

.cell-score {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--color-primary);
  white-space: nowrap;
}

.cell-breakdown {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.cell-score.is-unavailable,
.cell-breakdown.is-unavailable {
  color: var(--color-text-dim);
  font-family: var(--font-sans);
  font-weight: 600;
}

@media (max-width: 720px) {
  .sessions-table thead {
    display: none;
  }

  .sessions-table,
  .sessions-table tbody,
  .sessions-table tr,
  .sessions-table td {
    display: block;
    width: 100%;
  }

  .sessions-table tr {
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 0.65rem 0.8rem;
    margin-bottom: 0.65rem;
    background-color: var(--color-bg-subtle);
  }

  .sessions-table td {
    border-bottom: none;
    padding: 0.28rem 0;
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.75rem;
    text-align: right;
  }

  .sessions-table td::before {
    content: attr(data-label);
    font-size: 0.74rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-muted);
    text-align: left;
    flex-shrink: 0;
  }

  .cell-date {
    align-items: flex-end;
  }
}
</style>
