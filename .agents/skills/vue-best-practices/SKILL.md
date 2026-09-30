---
name: vue-best-practices
description: Load when writing or refactoring Vue 3 components, views, composables, or templates in CyberMorph. Enforces Composition API (<script setup>), component isolation, security practices (XSS prevention, safe error reflection), API separation, and integration with the project design system.
metadata:
  category: frontend-architecture
---

# Vue 3 Best Practices for CyberMorph

This skill outlines the architectural standards, code quality rules, and security guidelines for Vue 3 development in the CyberMorph codebase.

## Knowledge

### 1. Script Setup and Composition API
- Use `<script setup>` syntax for all components and views.
- Declare reactive state with `ref` for primitives and objects, or `reactive` for grouped state.
- Keep component logic focused: extract complex business or state logic into stores or composables.
- Explicitly define props and emits with `defineProps` and `defineEmits`:
  ```vue
  <script setup>
  const props = defineProps({
    title: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
  })

  const emit = defineEmits(['update', 'close'])
  </script>
  ```

### 2. Separation of Concerns (AGENTS.md Architecture Rule)
- **Zero Direct Axios Calls in Components**: Vue components and views must never call `apiClient.get/post/patch/delete` directly.
- All network communication must be imported from modules in `src/api/` (e.g., `src/api/classroom.js`, `src/api/analytics.js`).
- State that persists across views or drives authorization must live in Pinia stores under `src/stores/`.

### 3. Security & Safe Rendering
- **Never use `v-html` or `innerHTML`**: Raw HTML rendering introduces Cross-Site Scripting (XSS) risks. Use standard mustache interpolation `{{ }}` which automatically escapes HTML entities.
- **Never mirror raw backend exception strings**: Avoid direct `errorMessage.value = error.response.data.detail`. Map status codes and known error conditions to safe, user-friendly feedback strings.
- **Do not log sensitive objects**: Never use `console.error(error)` where `error` might contain Axios request payloads containing plaintext passwords, keys, or tokens.

### 4. Lifecycle Cleanups
- Any timers (`setTimeout`, `setInterval`), animation frames (`requestAnimationFrame`), or global event listeners (`window.addEventListener`) registered in `onMounted` must be cleaned up in `onUnmounted` to prevent memory leaks and zombie execution:
  ```javascript
  import { onMounted, onUnmounted } from 'vue'

  let timerId = null

  onMounted(() => {
    timerId = setInterval(pollStatus, 5000)
  })

  onUnmounted(() => {
    if (timerId) clearInterval(timerId)
  })
  ```

### 5. Template & Style Guidelines
- Use `<style scoped>` for all component-specific styling.
- Rely on global CSS variables from `src/assets/main.css` (`var(--color-primary)`, `var(--color-bg)`, `var(--shadow-purple)`, etc.).
- Never hardcode hex colors or arbitrary colors.
- Maintain the text-only convention: avoid decorative emojis or icons; use uppercase monospace tags (`SECTOR 01`, `STATUS: ACTIVE`).

## Instructions

1. **Review Architecture**: Check existing views in `src/views/` for consistent composition patterns before writing new components.
2. **API Isolation**: If a component needs data, verify or create the corresponding API function in `src/api/` before importing it.
3. **Verify Linting**: Always verify that components pass oxlint and ESLint:
   ```powershell
   npm run lint
   ```
4. **Follow Learning Rule**: When introducing or refactoring components, explain the component interface, props, and architectural role.

## References

Detailed guidelines and code examples for specific improvement areas are available in the `references/` directory:

- [Component Decomposition & Monolithic Views](file:///.agents/skills/vue-best-practices/references/component-decomposition.md)
- [Lifecycle Cleanup & Memory Leak Prevention](file:///.agents/skills/vue-best-practices/references/lifecycle-cleanup-memory-leaks.md)
- [Pinia State Architecture & API Decoupling](file:///.agents/skills/vue-best-practices/references/pinia-store-api-decoupling.md)
- [Reactivity & Computed Properties Optimization](file:///.agents/skills/vue-best-practices/references/reactivity-computed-optimization.md)
- [Vue Router Code Splitting & Navigation Architecture](file:///.agents/skills/vue-best-practices/references/router-code-splitting-navigation.md)
- [Design System Tokens & Style Hygiene](file:///.agents/skills/vue-best-practices/references/design-tokens-style-hygiene.md)
- [Accessibility (a11y) & Modal Dialog Standards](file:///.agents/skills/vue-best-practices/references/accessibility-modal-ux.md)

