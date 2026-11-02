---
name: cybermorph-ui-system
description: >
  Load when creating or modifying CyberMorph Vue views, components, or styles — any file under src/views/, src/components/, or touching markup and CSS. Enforces the centralized design system in src/assets/main.css (Direction 1 Modern Academic Cybersecurity: clean sans-serif typography, neutral slate surfaces, quiet borders, functional SVG icons, sentence case, and restrained purple accents).
metadata:
  category: frontend-design
---

# CyberMorph UI System Builder

`cybermorph-ui-system` is the **governing design skill for all routine CyberMorph UI, styling, and layout changes**.

`src/assets/main.css` is the single source of truth for design tokens, typography, and shared UI classes. Follow **Direction 1: Modern Academic Cybersecurity** for all portal interfaces: clean readability, neutral slate surfaces, quiet borders, and functional SVG icons with visible labels. Reach for existing tokens and shared classes first.

### Relationship to Other Design Skills
- **`cybermorph-ui-system`**: Governs all standard UI, view, and component work in CyberMorph.
- **`frontend-design`**: Consulted only when an explicit, project-wide visual redesign or brand-new aesthetic direction is requested.
- **`ui-ux-pro-max`**: Consulted for targeted domain queries (e.g. accessibility standards, animation timing, color harmony rules). Adding a page in CyberMorph must never generate a competing design system or override `src/assets/main.css`.
- **`web-design-guidelines`**: Used specifically for dedicated UI and accessibility compliance reviews.

## Knowledge

### Design Tokens (from `src/assets/main.css`)
- **Brand Accents**: `--color-primary` (#7c3aed), `--color-primary-hover` (#6d28d9), `--color-secondary` (#8b5cf6), `--color-violet-subtle` (#f5f3ff).
- **Surfaces**: `--color-bg` (#f8fafc), `--color-bg-subtle` (#f1f5f9), `--color-bg-muted` (#e2e8f0), `--color-card` (#ffffff).
- **Borders**: `--color-border` (#e2e8f0), `--color-border-subtle` (#f1f5f9), `--color-border-hover` (#cbd5e1).
- **Typography Colors**: `--color-text-main` (#0f172a), `--color-text-muted` (#475569), `--color-text-dim` (#94a3b8).
- **Semantic Alerts**:
  - Success: `--color-success` (#059669), `--color-success-bg` (#ecfdf5), `--color-success-border` (#a7f3d0).
  - Danger: `--color-danger` (#dc2626), `--color-danger-bg` (#fef2f2), `--color-danger-border` (#fecaca).
  - Warning: `--color-warning` (#d97706), `--color-warning-bg` (#fffbeb), `--color-warning-border` (#fde68a).
- **Elevation**: `--shadow-card`, `--shadow-card-hover`, `--shadow-sm`.
- **Fonts**:
  - `--font-display`: 'Inter' (portal headings, metrics, button text).
  - `--font-sans`: 'Inter' (body text, inputs, labels).
  - `--font-brand`: 'Pixelify Sans' (reserved for `[ CYBERMORPH ]` branding and game marketing).
  - `--font-mono`: 'JetBrains Mono' (6-char access keys, session UUIDs, identifiers).

### Icon System
- Shared functional SVG icons live in `src/components/common/AppIcon.vue` (zero external dependencies).
- Icons render with `aria-hidden="true"`, sized dynamically, inheriting `currentColor`.
- All icon-bearing interactive controls must provide visible text labels or explicit `aria-label` attributes.
- Decorative emojis are strictly prohibited across all portal views.

### Shared Component Classes (Reuse; Do Not Re-Declare)
- Buttons: `.btn-primary` (purple gradient, white text), `.btn-outline` (white card, subtle border), `.btn-subtle` (borderless hoverable).
- Status/badges: `.status-pill` (`.active` / `.inactive`), `.risk-badge` (`.risk-low` / `.risk-moderate` / `.risk-high` / `.no-data`), `.badge-dot`.
- Feedback: `.error-banner`, `.success-banner`, `.spinner`.

### Copy & Presentation Conventions
- **Sentence case & plain language**: Use standard sentence case for page titles, section headings, navigation links, and button labels (e.g. *"Create classroom"*, *"Threat analytics"*, *"Enrolled students"*).
- Avoid decorative uppercase monospace tags in the portal. Monospace is reserved for actual codes and data identifiers.
- Headings use `--font-display` ('Inter') with `font-weight: 600`.
- Forms and interactive elements include visible `:focus-visible` outlines.

### State Integrity
- Never render failed network requests as `0` counts. Render explicit loading states (`.spinner`) and error states (`.error-banner`) with a retry action.
- When an API response does not contain a field (e.g. unattempted threat category is `null`), render an honest empty indicator (e.g. *"No attempts recorded"*), never *"0% fail rate"*.

## Instructions

1. **Tokens before hex**: Check `src/assets/main.css` first; reuse existing tokens and classes. Never hardcode hex codes.
2. **Component reuse**: Reuse existing components (such as `ClassroomCard.vue` and `ClassroomCreateModal.vue`) before creating new ones.
3. **Responsive containment**: Cards stack actions cleanly on mobile (`<= 480px`) and touch targets meet the 44px minimum requirement.
4. **Accessible controls**: Decorative icons must use `aria-hidden="true"`; buttons must have accessible names.
5. **Verify with non-fixing commands**:
   ```powershell
   npx oxlint .
   npx eslint .
   ```
