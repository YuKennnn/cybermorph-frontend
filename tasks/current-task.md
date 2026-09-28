# Current Task: UI Polish, Centralized main.css & Routing Architecture

## Task Summary
Refine and polish the CyberMorph educator and public interface to establish `src/assets/main.css` as the single source of truth for design tokens, ensure the public landing page (`/`) serves as the default entry point without bouncing unauthenticated visitors, resolve button overcrowding on classroom cards with multi-tier containment, eliminate emojis from public and authenticated views in favor of a minimalist text-focused presentation, and ensure reliable session hydration on reload.

## Completed Objectives
1. **Centralized Design System Architecture (`src/assets/main.css`, `src/App.vue`, `src/main.js`)**:
   - Created `src/assets/main.css` consolidating `:root` variables, reset rules, body gradient styling, heading typography, and shared UI classes (`.btn-primary`, `.btn-outline`, `.status-pill`, `.risk-badge`, `.spinner`, `.error-banner`, `.success-banner`).
   - Imported `src/assets/main.css` globally in `src/main.js`.
   - Scoped `src/App.vue` style block (`<style scoped>`) to contain only layout scaffolding (`.app-layout`, `.main-content`, `.content-wrapper`).

2. **Public Entry & Router Guard Alignment (`src/router/index.js`)**:
   - Ensured route `/` maps to `LandingView.vue` as a public view.
   - Updated navigation guard in `router.beforeEach` so that visitors navigating to `/` always land on the public landing page without unwanted redirects to `/login`.
   - Protected routes explicitly requiring `meta.requiresAuth` while redirecting authenticated users from `/login` and `/register` directly to `/dashboard`.

3. **Text-Focused Minimalist Landing Page (`src/views/LandingView.vue`)**:
   - Removed OS emojis from 3 Core Pillars ("Play", "Learn", "Track"), 4 Simulation Maps, and 8 Threat Curriculum cards.
   - Implemented clean monospace tags (`PILLAR 01` - `03`, `SECTOR 01` - `04`, `THREAT 01` - `08`).
   - Standardized map tags to clean text `UNLOCKED` / `LOCKED`.
   - Replaced all raw slate hex codes (`#f1f5f9`, `#64748b`, `#cbd5e1`, `#f1edff`) with design system tokens (`var(--color-bg-subtle)`, `var(--color-border)`, `var(--color-text-dim)`).
   - Added conditional authenticated header navigation (linking directly to `/dashboard` when logged in).

4. **Classroom Cards Action Containment (`src/views/ClassroomManagementView.vue`)**:
   - Replaced single-row overflowing button flex layout with a structured 2-tier layout:
     - Tier 1: `.primary-actions` (equal-width 2-column grid for `[ Students ]` and `[ Analytics ]` with `min-width: 0` and ellipsis protection).
     - Tier 2: `.utility-actions` (subtle secondary text actions for `Edit` and `Delete`).
   - Added container clipping `overflow: hidden; box-sizing: border-box;` and responsive mobile stack at `<= 480px`.
   - Removed decorative emojis (`✓`, `⚠️`, `👥`, `📈`) and replaced `#ede9fe` with `var(--color-bg-muted)`.

5. **Authentication Session Hydration & Role Mapping (`src/stores/authStore.js`, `src/views/DashboardView.vue`)**:
   - Persisted and hydrated `user` and `userRole` in `localStorage` alongside `cyber_token`.
   - Case-normalized user role checks in `DashboardView.vue` (`admin`, `educator`, `player`).

6. **Sidebar Navigation & Telemetry Drill-Down Polish (`src/components/SidebarNav.vue`, `src/views/EducatorAnalyticsView.vue`)**:
   - Enforced text-only labels in sidebar with zero emojis and zero replacement icons.
   - Stripped emojis across all 3 tiers of telemetry drill-downs, standardizing risk badges to subtle semantic tints.

## Verification Checklist
- [x] Initial navigation to `/` serves `LandingView.vue` without redirecting unauthenticated visitors to `/login`.
- [x] `src/assets/main.css` holds centralized design tokens and resets, imported via `src/main.js`.
- [x] `src/App.vue` contains only scoped layout scaffolding.
- [x] Landing page is free of OS emojis and utilizes clean monospace sector/pillar tags and design tokens.
- [x] Classroom management cards contain buttons cleanly within card boundaries on all viewports.
- [x] Sidebar navigation is text-only.
- [x] Session state preserves on page reload (`F5`).
- [x] `npm run lint` passes with 0 errors and 0 warnings.
- [x] `npm run build` completes successfully.