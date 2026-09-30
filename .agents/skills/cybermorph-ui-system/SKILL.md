---
name: cybermorph-ui-system
description: Load when creating or modifying CyberMorph Vue views, components, or styles — any file under src/views/, src/components/, or touching markup and CSS. Enforces the centralized design system in src/assets/main.css (design tokens, shared classes, text-only minimalist presentation) and prevents hardcoded hex codes, emojis, and layout drift.
metadata:
  category: frontend-design
---

# CyberMorph UI System Builder

`src/assets/main.css` is the declared single source of truth for design
tokens and shared UI classes. Past polish cycles repeatedly removed hardcoded
hex codes and emojis by hand — do not reintroduce them. Reach for tokens and
shared classes first; add new ones only when genuinely reusable.

## Knowledge

### Design tokens (from src/assets/main.css)
- **Brand**: `--color-primary` (#7c3aed), `--color-primary-hover` (#6d28d9),
  `--color-secondary` (#8b5cf6), `--color-accent` (#c084fc).
- **Surfaces**: `--color-bg`, `--color-bg-subtle`, `--color-bg-muted`,
  `--color-card`, `--color-card-hover`.
- **Borders**: `--color-border`, `--color-border-subtle`.
- **Text tiers**: `--color-text-main`, `--color-text-muted`,
  `--color-text-dim`.
- **Semantic alerts** (each with `-bg` and `-border` companions):
  `--color-success`, `--color-danger`, `--color-warning`.
- **Elevation**: `--shadow-purple`, `--shadow-purple-hover`,
  `--shadow-purple-sm`.
- **Gradients**: `--btn-gradient`, `--btn-gradient-hover`.
- **Fonts**: `--font-display` (Pixelify Sans — headings, buttons, display),
  `--font-sans` (Inter — body), `--font-mono` (JetBrains Mono — badges, tags,
  data).

### Shared component classes (reuse; do not re-declare)
- Buttons: `.btn-primary`, `.btn-outline` (both inline-flex, disabled states
  included).
- Status/badges: `.status-pill` with `.active` / `.inactive` variants;
  `.risk-badge` with `.risk-low` / `.risk-moderate` / `.risk-high` /
  `.no-data`; `.badge-dot` indicator.
- Feedback: `.error-banner`, `.success-banner`, `.spinner` (+ `@keyframes
  spin` already defined globally).

### Style conventions
- Views live in `src/views/*.vue`, components in `src/components/`, using
  `<script setup>`.
- Scoped `<style scoped>` per component; when using `@apply` inside scoped
  styles, first add `@reference "../../assets/main.css";` (see the pattern in
  `src/views/LandingView.vue`). Avoid raw `@apply` with undefined utilities.
- `App.vue` styles contain layout scaffolding only (`.app-layout`,
  `.main-content`, `.content-wrapper`); keep it that way.
- Headings automatically use `--font-display` via global `h1..h6` rules; body
  text inherits `--font-sans`. Monospace `font-family: var(--font-mono)` is
  the idiom for tags and data.

### Presentation rules
- **Strictly text-only**: no emojis, no icon fonts, no decorative glyphs in
  public or authenticated UI. This is a deliberate minimalist convention.
- Visual markers use the monospace uppercase eyebrow/tag idiom: `SECTOR 01`,
  `THREAT 01`, `PILLAR 01` (see LandingView).
- Use semantic status colors only through `.status-pill` / `.risk-badge`
  variants; success/danger/warning token pairs for banners and alerts.
- Map showcase cards use a retro 4:3 aspect ratio with sector badges and
  UNLOCKED/LOCKED pills.

### Layout and responsiveness patterns
- Card containment (from ClassroomManagementView): two-tier action layout —
  `.primary-actions` (equal-width grid, `min-width: 0`, ellipsis protection)
  for main actions, `.utility-actions` (subtle secondary row) for Edit/Delete.
- Apply `overflow: hidden; box-sizing: border-box` on cards; stack actions
  vertically at `<= 480px`.
- Page feedback pattern: `isLoading` + `errorMessage`/`successMessage` refs
  bound to `.spinner` / `.error-banner` / `.success-banner`.

## Instructions

1. **Tokens before hex.** Check `src/assets/main.css` first; reuse existing
   tokens and classes. Never hardcode hex codes or re-declare shared classes.
   Add a new token/class to `main.css` only if genuinely reusable, and
   document it in place with a comment.
2. **Match existing structure.** Follow current view/component organization;
   keep `<script setup>`; make small focused diffs; do not modify unrelated
   files (per AGENTS.md).
3. **Text-only presentation.** No emojis or icons in any new markup. Prefer a
   monospace tag (e.g., `SECTION 01`) when a visual marker helps.
4. **Consistent states.** Every data view gets loading (`.spinner`), error
   (`.error-banner`), success (`.success-banner`), and empty states using the
   shared classes — same pattern as existing views.
5. **Responsive containment.** New cards/lists must not overflow at narrow
   widths: use the two-tier action layout, clipping, and `<= 480px` stacking.
6. **Semantic colors.** Status/risk indication only via `.status-pill` /
   `.risk-badge` variants — never ad-hoc colored inline styles.
7. **Verify.** Run `npm run lint` (0 errors, 0 warnings) and `npm run build`.
   If the change alters a visible screen, note in the summary which states
   (loading/error/success/empty) should be eyeballed and at which viewport
   widths.

For non-trivial changes, follow the AGENTS.md learning rule: explain the
problem, approach, files changed, implementation, what changed, and verification
steps.
