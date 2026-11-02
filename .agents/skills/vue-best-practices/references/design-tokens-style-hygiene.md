# Design System Tokens & Style Hygiene

## Context & Principles

CyberMorph enforces a centralized design system located in `src/assets/main.css`. The system uses CSS custom properties (`:root`) for colors, backgrounds, borders, elevation, and typography.

Following `cybermorph-ui-system`:
- Reach for existing tokens and shared classes first.
- Never hardcode hex codes or arbitrary colors in component styles.
- Follow Direction 1: Modern Academic Cybersecurity (clean sans-serif typography, neutral slate surfaces, quiet borders, and functional SVG icons with visible labels).

---

## Token Mapping Reference

Always map colors to the design tokens defined in `src/assets/main.css`:

| Role | Standard Design System Token | Example Token Value |
| :--- | :--- | :--- |
| Brand primary | `var(--color-primary)` | `#7c3aed` |
| Brand primary hover | `var(--color-primary-hover)` | `#6d28d9` |
| Brand secondary | `var(--color-secondary)` | `#8b5cf6` |
| Page background | `var(--color-bg)` | `#f8fafc` |
| Subtle background | `var(--color-bg-subtle)` | `#f1f5f9` |
| Muted background | `var(--color-bg-muted)` | `#e2e8f0` |
| Card surface | `var(--color-card)` | `#ffffff` |
| Border standard | `var(--color-border)` | `#e2e8f0` |
| Border subtle | `var(--color-border-subtle)` | `#f1f5f9` |
| Border hover | `var(--color-border-hover)` | `#cbd5e1` |
| Text main | `var(--color-text-main)` | `#0f172a` |
| Text muted | `var(--color-text-muted)` | `#475569` |
| Text dim | `var(--color-text-dim)` | `#94a3b8` |
| Success alert | `var(--color-success)` | `#059669` |
| Success background | `var(--color-success-bg)` | `#ecfdf5` |
| Danger alert | `var(--color-danger)` | `#dc2626` |
| Danger background | `var(--color-danger-bg)` | `#fef2f2` |
| Warning alert | `var(--color-warning)` | `#d97706` |
| Warning background | `var(--color-warning-bg)` | `#fffbeb` |

---

## Shared Utilities to Reuse

Instead of inventing custom CSS blocks, reuse the shared utility classes declared in `src/assets/main.css`:
- **Buttons**: `.btn-primary`, `.btn-outline`, `.btn-subtle`
- **Pills & Badges**: `.status-pill.active`, `.status-pill.inactive`, `.risk-badge.risk-low`, `.risk-badge.risk-moderate`, `.risk-badge.risk-high`, `.badge-dot`
- **Feedback Alerts**: `.error-banner`, `.success-banner`
- **Loading Indicators**: `.spinner`

---

## UI Presentation Conventions

- **Sentence Case**: Use standard sentence case for navigation, headings, section titles, and action labels (*"Create classroom"*, *"Threat analytics"*, *"Enrolled students"*).
- **No Decorative Monospace Tags**: Avoid decorative uppercase monospace tags. Monospace (`--font-mono`: JetBrains Mono) is reserved for actual codes, UUIDs, and data identifiers.
- **Zero Decorative Emojis**: Do not use emojis in production UI markup. Use functional SVG icons via `src/components/common/AppIcon.vue` with accessible labels.
- **Accessible Focus States**: Maintain visible `:focus-visible` outlines on all interactive elements.

---

## Verification Steps
1. Verify with non-fixing linting:
   ```powershell
   npx oxlint .
   npx eslint .
   ```
2. Search for raw hex codes in component style blocks:
   ```powershell
   git grep -E "#[0-9a-fA-F]{3,8}\b" -- "src/views/" "src/components/"
   ```
   Confirm that any matched hex codes are within legitimate inline graphics (such as SVG illustrations) and not in component `<style>` declarations.
