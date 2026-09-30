# Design System Tokens & Style Hygiene

## Context & Problem Statement

CyberMorph enforces a centralized design system located in `src/assets/main.css`. The system uses CSS custom properties (`:root`) for colors, backgrounds, borders, elevation, and fonts.

While past refactorings eliminated many hardcoded hex codes, several views still contain residual hardcoded hex codes, ad-hoc linear gradients, and arbitrary colors:

1. **`src/views/LeaderboardView.vue` (lines 416-429)**:
   - Rank 1 Gold: `background: linear-gradient(135deg, #fef08a 0%, #fde047 100%); color: #854d0e;`
   - Rank 2 Silver: `background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); color: #334155;`
   - Rank 3 Bronze: `background: linear-gradient(135deg, #fed7aa 0%, #fdba74 100%); color: #9a3412;`
2. **`src/views/PlayerDashboard.vue` (lines 133-164)**:
   - `background: linear-gradient(180deg, #ffffff 0%, #faf8ff 100%);`
   - `background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);`
3. **`src/views/LandingView.vue` (lines 1218-1430)**:
   - Hex codes `#0f172a`, `#1e1b4b`, `#f1f5f9` hardcoded into CSS declarations.

### Architectural Risks
- **Design Drift**: When global theme colors or contrast ratios are adjusted, hardcoded elements break visual coherence.
- **Dark Mode / Accessibility Inflexibility**: The inability to switch themes because colors are hardcoded rather than referencing tokens.
- **Contract Violation**: Violates `.agents/skills/cybermorph-ui-system/SKILL.md` Instruction 1: *"Tokens before hex. Never hardcode hex codes or re-declare shared classes."*

---

## Token Mapping Reference

Always map arbitrary colors to the design tokens in `src/assets/main.css`:

| Hardcoded Value | Intended Role | Standard Design System Token |
| :--- | :--- | :--- |
| `#7c3aed` | Brand primary | `var(--color-primary)` |
| `#6d28d9` | Brand primary hover | `var(--color-primary-hover)` |
| `#8b5cf6` | Brand secondary | `var(--color-secondary)` |
| `#c084fc` | Brand accent | `var(--color-accent)` |
| `#fafafa` | Page background | `var(--color-bg)` |
| `#f5f3ff` | Subtle background | `var(--color-bg-subtle)` |
| `#ede9fe` | Muted background | `var(--color-bg-muted)` |
| `#ffffff` | Card surface | `var(--color-card)` |
| `#faf8ff` | Card hover | `var(--color-card-hover)` |
| `#e9d5ff` | Border standard | `var(--color-border)` |
| `#f3e8ff` | Border subtle | `var(--color-border-subtle)` |
| `#1e1b4b` | Text main | `var(--color-text-main)` |
| `#6d6b7a` | Text muted | `var(--color-text-muted)` |
| `#94a3b8` | Text dim | `var(--color-text-dim)` |
| `#059669` | Success alert | `var(--color-success)` |
| `#ecfdf5` | Success background | `var(--color-success-bg)` |
| `#dc2626` | Danger alert | `var(--color-danger)` |
| `#fef2f2` | Danger background | `var(--color-danger-bg)` |
| `#d97706` | Warning alert | `var(--color-warning)` |
| `#fffbeb` | Warning background | `var(--color-warning-bg)` |

---

## Shared Utilities to Reuse

Instead of inventing custom CSS blocks, reuse the shared utility classes declared in `src/assets/main.css`:
- **Buttons**: `.btn-primary`, `.btn-outline`
- **Pills & Badges**: `.status-pill.active`, `.status-pill.inactive`, `.risk-badge.risk-low`, `.risk-badge.risk-moderate`, `.risk-badge.risk-high`, `.badge-dot`
- **Feedback Alerts**: `.error-banner`, `.success-banner`
- **Loading Indicators**: `.spinner`

---

## Text-Only Minimalist Convention

As dictated by the project instructions:
- **Zero Decorative Emojis**: Do not use `⚡`, `🎉`, `⚠️`, `👥`, `🛡️`, `📜` in UI markup.
- **Zero Glyph Icons**: Do not use icon fonts or arbitrary unicode arrow glyphs (`←`, `✕`) in production markup.
- **Monospace Tags**: Use uppercase monospace eyebrow tags:
  ```html
  <span class="eyebrow-tag">SECTOR 01</span>
  <span class="eyebrow-tag">THREAT 04</span>
  <span class="eyebrow-tag">[ DISMISS ]</span>
  ```

---

## Verification Steps
1. Run ripgrep across `src/views/` and `src/components/`:
   ```powershell
   git grep -E "#[0-9a-fA-F]{3,8}\b" -- src/
   ```
2. Verify that any matched hex codes are within legitimate inline SVG graphics (e.g. game map illustrations) and not in component `<style>` blocks.
