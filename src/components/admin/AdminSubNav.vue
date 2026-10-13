<script setup>
defineProps({
  pendingCount: {
    type: Number,
    default: null,
  },
})
</script>

<template>
  <nav class="admin-subnav" aria-label="Admin User Navigation">
    <router-link to="/admin/users" class="subnav-tab">
      All users
    </router-link>
    <router-link to="/admin/approvals" class="subnav-tab">
      <span>Educator approvals</span>
      <span v-if="pendingCount !== null && pendingCount > 0" class="subnav-badge">
        {{ pendingCount }}
      </span>
    </router-link>
  </nav>
</template>

<style scoped>
.admin-subnav {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 1.75rem;
}

.subnav-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 1.15rem;
  color: var(--color-text-muted);
  text-decoration: none;
  font-family: var(--font-sans);
  font-size: 0.92rem;
  font-weight: 500;
  border-bottom: 2px solid transparent;
  transition: all 0.15s ease;
  margin-bottom: -1px;
}

.subnav-tab:hover {
  color: var(--color-text-main);
  border-bottom-color: var(--color-border-hover);
}

.subnav-tab.router-link-active {
  color: var(--color-primary);
  font-weight: 600;
  border-bottom-color: var(--color-primary);
}

.subnav-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-warning-bg);
  color: var(--color-warning);
  border: 1px solid var(--color-warning-border);
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.1rem 0.45rem;
  border-radius: 9999px;
  line-height: 1;
}
</style>
