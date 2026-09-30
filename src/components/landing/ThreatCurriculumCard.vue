<script setup>
defineProps({
  threat: {
    type: Object,
    required: true,
  },
})
</script>

<template>
  <div class="threat-card">
    <div class="threat-tag">{{ threat.code }}</div>
    <h4>{{ threat.name }}</h4>
    <p>{{ threat.description }}</p>
  </div>
</template>

<style scoped>
.threat-card {
  background-color: var(--color-card);
  border: 1.5px solid var(--color-border);
  border-radius: 12px;
  padding: 1.75rem;
  box-shadow: var(--shadow-purple);
  transition: all 0.25s ease;
  display: flex;
  flex-direction: column;
}

.threat-card:hover {
  transform: translateY(-3px);
  border-color: var(--color-primary);
  box-shadow: var(--shadow-purple-hover);
}

.threat-tag {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-primary);
  background-color: var(--color-bg-muted);
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
  align-self: flex-start;
  margin-bottom: 1rem;
  letter-spacing: 0.05em;
}

.threat-card h4 {
  margin: 0 0 0.6rem 0;
  font-size: 1.15rem;
  color: var(--color-text-main);
  line-height: 1.35;
}

.threat-card p {
  margin: 0;
  font-size: 0.9rem;
  color: var(--color-text-muted);
  line-height: 1.55;
}
</style>
