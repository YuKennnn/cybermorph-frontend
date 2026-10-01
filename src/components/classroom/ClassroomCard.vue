<script setup>
defineProps({
  classroom: {
    type: Object,
    required: true,
  },
})

defineEmits(['view-students', 'view-analytics', 'edit', 'delete'])
</script>

<template>
  <div class="classroom-card">
    <div class="card-top">
      <div class="code-tag">CODE: {{ classroom.code_value || classroom.code }}</div>
      <span :class="['status-pill', classroom.is_active ? 'active' : 'inactive']">
        {{ classroom.is_active ? 'ACTIVE' : 'INACTIVE' }}
      </span>
    </div>

    <h3 class="classroom-name">{{ classroom.name }}</h3>
    <div class="card-meta">
      <span class="student-count">{{ classroom.student_count || 0 }} Enrolled Agents</span>
    </div>

    <div class="card-actions">
      <div class="primary-actions">
        <button class="btn-roster" @click="$emit('view-students', classroom.code_id || classroom.id)">
          Students
        </button>
        <button class="btn-analytics" @click="$emit('view-analytics', classroom.code_id || classroom.id || classroom.code_value)">
          Analytics
        </button>
      </div>
      <div class="utility-actions">
        <button class="btn-utility edit" @click="$emit('edit', classroom)">Edit</button>
        <span class="utility-divider">·</span>
        <button class="btn-utility delete" @click="$emit('delete', classroom)">Delete</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.classroom-card {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-purple);
  transition: all 0.2s ease;
  overflow: hidden;
  box-sizing: border-box;
}

.classroom-card:hover {
  box-shadow: var(--shadow-purple-hover);
  border-color: var(--color-secondary);
  transform: translateY(-2px);
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.code-tag {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  font-weight: 700;
  background-color: var(--color-bg-muted);
  color: var(--color-primary);
  border: 1px solid var(--color-border);
  padding: 0.25rem 0.65rem;
  border-radius: 6px;
  letter-spacing: 0.05em;
}

.status-pill {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.2rem 0.55rem;
  border-radius: 4px;
}

.status-pill.active {
  background-color: var(--color-success-bg);
  color: var(--color-success);
  border: 1px solid var(--color-success-border);
}

.status-pill.inactive {
  background-color: var(--color-bg-subtle);
  color: var(--color-text-dim);
  border: 1px solid var(--color-border);
}

.classroom-name {
  margin: 0 0 0.5rem 0;
  color: var(--color-text-main);
  font-size: 1.25rem;
}

.card-meta {
  padding: 0.75rem 0;
  border-top: 1px solid var(--color-border-subtle);
  font-size: 0.88rem;
  color: var(--color-primary);
  font-weight: 600;
  margin-bottom: 1rem;
}

.card-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: auto;
}

.primary-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem;
  width: 100%;
}

.btn-roster,
.btn-analytics {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0.55rem 0.75rem;
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 0.85rem;
  font-weight: 600;
  text-align: center;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
}

.btn-roster {
  background: var(--color-bg-subtle);
  color: var(--color-primary);
  border: 1.5px solid var(--color-border);
}

.btn-roster:hover {
  background: var(--color-bg-muted);
  border-color: var(--color-primary);
}

.btn-analytics {
  background: var(--color-card);
  color: var(--color-primary);
  border: 1.5px solid var(--color-border);
}

.btn-analytics:hover {
  background: var(--color-bg-subtle);
  border-color: var(--color-primary);
  transform: translateY(-1px);
}

.utility-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.5rem;
  padding-top: 0.4rem;
  border-top: 1px solid var(--color-border-subtle);
}

.btn-utility {
  background: none;
  border: none;
  font-family: var(--font-sans);
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.2rem 0.45rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-utility.edit {
  color: var(--color-text-muted);
}

.btn-utility.edit:hover {
  color: var(--color-primary);
  background-color: var(--color-bg-subtle);
}

.btn-utility.delete {
  color: var(--color-text-dim);
}

.btn-utility.delete:hover {
  color: var(--color-danger);
  background-color: var(--color-danger-bg);
}

.utility-divider {
  color: var(--color-border);
  font-size: 0.8rem;
}

@media (max-width: 480px) {
  .primary-actions {
    grid-template-columns: 1fr;
  }
}
</style>
