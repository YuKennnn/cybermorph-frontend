# Current Task: UI Polish, Centralized main.css & Routing Architecture

## Task Summary
Refine and polish the CyberMorph educator and public interface to establish `src/assets/main.css` as the single source of truth for design tokens, ensure the public landing page (`/`) serves as the default entry point without bouncing unauthenticated visitors, resolve button overcrowding on classroom cards with multi-tier containment, eliminate emojis from public and authenticated views in favor of a minimalist text-focused presentation, integrate the interactive hero canvas mini-game, and embed the 4-sector simulation map gallery showcase with bundled map imagery.

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
   - Removed OS emojis from 3 Core Pillars ("Play", "Learn", "Track") and 8 Threat Curriculum cards.
   - Implemented clean monospace tags (`PILLAR 01` - `03`, `THREAT 01` - `08`).
   - Replaced all raw slate hex codes (`#f1f5f9`, `#64748b`, `#cbd5e1`, `#f1edff`) with design system tokens (`var(--color-bg-subtle)`, `var(--color-border)`, `var(--color-text-dim)`).
   - Added conditional authenticated header navigation (linking directly to `/dashboard` when logged in).

4. **Interactive Hero Canvas Mini-Game (`src/views/LandingView.vue`)**:
   - Implemented 2D HTML5 canvas simulation running in the hero background behind text elements (`pointer-events: none`).
   - Integrated 32x32 operative sprite tracking cursor dynamically with smooth interpolation, walking bounce animation (`Math.sin`), and red glowing directional visor eyes pivoting toward movement vector.
   - Configured 6 procedural server terminal racks (60x90 px) placed with a central text exclusion boundary (`textWidth`, `textHeight`, `textTop`, `textBottom`) preventing headline overlap.
   - Added AABB collision detection triggering breach alarms (rack jitter, LEDs flashing cyan to red, dashed pulsing breach circle, and floating monospace "BREACH!" banner).
   - Added pulsing green tactical crosshair reticle following active cursor position.
   - Built safe lifecycle management (`requestAnimationFrame`, `cancelAnimationFrame`, `resize` event cleanup).

5. **Simulation Map Gallery Showcase (`src/views/LandingView.vue`)**:
   - Created 4-sector curriculum showcase anchored to `#showcase`.
   - Imported map image assets directly from `src/assets/maps/` (`home.png`, `internet-cafe.png`, `office.png`, `public-park.png`) for Vite bundling.
   - Implemented retro 4:3 aspect ratio cards (`.aspect-retro`) with sector badges (`SECTOR 01` - `04`), unlock statuses (`UNLOCKED` / `LOCKED`), focus tags, difficulty tiers (`Beginner`, `Intermediate`, `Advanced`, `Master`), and SVG fallback support.
   - Wired hero button "View Showcase" to smooth-scroll directly to `#showcase`.

6. **Classroom Cards Action Containment (`src/views/ClassroomManagementView.vue`)**:
   - Replaced single-row overflowing button flex layout with a structured 2-tier layout:
     - Tier 1: `.primary-actions` (equal-width 2-column grid for `[ Students ]` and `[ Analytics ]` with `min-width: 0` and ellipsis protection).
     - Tier 2: `.utility-actions` (subtle secondary text actions for `Edit` and `Delete`).
   - Added container clipping `overflow: hidden; box-sizing: border-box;` and responsive mobile stack at `<= 480px`.
   - Removed decorative emojis (`✓`, `⚠️`, `👥`, `📈`) and replaced `#ede9fe` with `var(--color-bg-muted)`.

7. **Authentication Session Hydration & Role Mapping (`src/stores/authStore.js`, `src/views/DashboardView.vue`)**:
   - Persisted and hydrated `user` and `userRole` in `localStorage` alongside `cyber_token`.
   - Case-normalized user role checks in `DashboardView.vue` (`admin`, `educator`, `player`).

8. **Sidebar Navigation & Telemetry Drill-Down Polish (`src/components/SidebarNav.vue`, `src/views/EducatorAnalyticsView.vue`)**:
   - Enforced text-only labels in sidebar with zero emojis and zero replacement icons.
   - Stripped emojis across all 3 tiers of telemetry drill-downs, standardizing risk badges to subtle semantic tints.

## Verification Checklist
- [x] Initial navigation to `/` serves `LandingView.vue` without redirecting unauthenticated visitors to `/login`.
- [x] `src/assets/main.css` holds centralized design tokens and resets, imported via `src/main.js`.
- [x] `src/App.vue` contains only scoped layout scaffolding.
- [x] Interactive hero canvas mini-game runs in background with operative cursor tracking, AABB collision, and breach animations.
- [x] Server racks avoid central text exclusion zone and adapt dynamically on resize.
- [x] Simulation Map Gallery Showcase (`#showcase`) displays 4 maps using bundled images from `src/assets/maps/` in retro 4:3 cards.
- [x] "View Showcase" hero CTA smoothly scrolls to `#showcase`.
- [x] Classroom management cards contain buttons cleanly within card boundaries on all viewports.
- [x] Sidebar navigation is text-only.
- [x] Session state preserves on page reload (`F5`).
- [x] `npm run lint` passes with 0 errors and 0 warnings.
- [x] `npm run build` completes successfully.