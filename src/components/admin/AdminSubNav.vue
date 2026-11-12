<script setup>
defineProps({
  pendingCount: {
    type: Number,
    default: null,
  },
})
</script>

<template>
  <nav class="admin-subnav" aria-label="Admin Management Navigation">
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
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: var(--shadow-sm);
  margin-bottom: 1.75rem;
  overflow-x: auto;
  max-width: 100%;
  -webkit-overflow-scrolling: touch;
}

.subnav-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 38px;
  padding: 0.45rem 1.05rem;
  color: var(--color-text-muted);
  text-decoration: none;
  font-family: var(--font-sans);
  font-size: 0.88rem;
  font-weight: 600;
  border-radius: 9px;
  border: 1px solid transparent;
  transition:
    background-color 0.16s ease,
    color 0.16s ease,
    border-color 0.16s ease,
    box-shadow 0.16s ease;
  white-space: nowrap;
  flex-shrink: 0;
}

.subnav-tab:hover:not(.router-link-active) {
  background-color: var(--color-violet-subtle);
  color: var(--color-primary);
}

.subnav-tab.router-link-active {
  background: var(--btn-gradient);
  border-color: var(--nav-pill-border);
  color: #ffffff;
  font-weight: 700;
  box-shadow: var(--btn-rim-shadow);
}

.subnav-tab:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.subnav-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-warning-bg);
  color: var(--color-warning);
  border: 1px solid var(--color-warning-border);
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.12rem 0.48rem;
  border-radius: 9999px;
  line-height: 1;
}

.subnav-tab.router-link-active .subnav-badge {
  background-color: rgba(255, 255, 255, 0.2);
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.35);
}
</style>
