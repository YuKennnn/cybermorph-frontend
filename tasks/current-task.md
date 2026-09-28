# Current Task: UI Polish & CyberMorph Color/Layout Cohesion

## Task
Refine and polish the CyberMorph educator interface to resolve button overcrowding on classroom cards, remove decorative emojis in favor of a clean **text-only navigation**, and unify the color palette around the core CyberMorph Purple/White Design System without altering the established visual identity or redesigning the application.

## Objectives
1. **Sidebar Navigation (`src/components/SidebarNav.vue`)**:
   - Completely remove multi-colored platform emojis from navigation items and the logout button.
   - Use clean, text-only navigation labels ("Dashboard", "Leaderboard", "Manage Classrooms", "Threat Analytics", "Log Out").
   - Adjust padding and text alignment for clean text-only layout.
   - Unify the user role pill (`.role-pill.educator`) to use `var(--color-primary)` instead of vivid green.
2. **Classroom Cards (`src/views/ClassroomManagementView.vue`)**:
   - Restructure card actions into a 2-tier layout:
     - Tier 1: `.primary-actions` (equal-width 2-column grid for `[ Students ]` and `[ Analytics ]` without text wrapping).
     - Tier 2: `.utility-actions` (subtle, secondary utility row for `Edit` and `Delete`).
   - Remove trailing emoji `📈` from button labels.
   - Increase card grid column minimum to `minmax(310px, 1fr)` for comfortable spacing.
   - Replace hardcoded slate colors (`#cbd5e1`, `#64748b`, `#f1f5f9`) with design tokens (`--color-border-subtle`, `--color-text-muted`, `--color-bg-subtle`).
   - Harmonize active/inactive status pill styling with the purple design system.
3. **Educator Dashboard (`src/views/EducatorDashboard.vue`) & Students View (`src/views/ClassroomStudentsView.vue`)**:
   - Remove trailing emoji `📈` from the "Threat Analytics" and "Sector Analytics" action buttons.
4. **Code Quality**:
   - 0 linter errors and 0 warnings (`npm run lint`).
   - Clean production build (`npm run build`).

## Verification Checklist
1. `npm run lint` passes with 0 errors and 0 warnings.
2. `npm run build` completes successfully.
3. Sidebar navigation uses clean text-only labels with zero emojis or icons.
4. Role pill in the sidebar user snippet uses the unified CyberMorph violet palette.
5. Classroom management cards render with a 2-tier action layout where "Students" and "Analytics" sit side by side without text wrapping.
6. "Edit" and "Delete" are subtle utility actions with delete highlighting danger red only on hover.
7. Slate hex codes are eliminated in favor of CyberMorph theme variables.