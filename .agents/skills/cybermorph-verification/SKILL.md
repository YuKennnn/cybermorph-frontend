---
name: cybermorph-verification
description: Guidance for verifying changes in CyberMorph proportional to change scope — static analysis, UI/responsive layout checks, session and request isolation, and distinguishing static, mocked, and live backend verification.
metadata:
  category: verification
---

# CyberMorph Verification Standards

This skill provides testing and verification guidance for CyberMorph. It ensures verification effort matches the scope and risk of changes without building unnecessary test harnesses.

---

## 1. Proportional Verification Hierarchy

Match verification effort directly to what changed:

| Change Scope | Required Verification | What NOT to Do |
| :--- | :--- | :--- |
| **Documentation & Markdown** | Verify links, file references, YAML frontmatter, and consistency with source. | Do not run full application builds or browser tests for docs-only changes. |
| **UI & Styling** | Run non-fixing linting. Inspect responsive layout down to mobile viewports (`320px`–`480px`) and check layout resilience under 200% text enlargement. | Do not build a new testing harness for minor CSS tweaks. |
| **Stores & Application State** | Verify state cleanup on logout, account switching, stale-response concurrency guards, and session isolation. | Do not default unverified roles or leak domain store state. |
| **API & Network Integration** | Verify endpoint contracts against `API_GUIDE.md`. Run non-fixing lint and `npm run build`. Verify mock parity if using mocks. | Do not assume an unauthenticated 401 proves endpoint functionality. |

---

## 2. Non-Fixing Verification Commands

Always run non-fixing verification commands so that linters do not mutate files unexpectedly during checks:

```powershell
# Fast static linting
npx oxlint .

# Comprehensive Vue/ESLint checks
npx eslint .

# Production build check (when JS/Vue source changed)
npm run build
```

> [!WARNING]
> Do not use `npm run lint` for read-only verification, because `package.json` configures it to run `oxlint . --fix` and `eslint . --fix`, which automatically mutates files without developer review.

---

## 3. Verification Tiers: Static vs. Mocked vs. Live

Distinguish clearly between what each tier proves:

### Tier 1: Static Verification
- Oxlint and ESLint confirm syntax validity, unused variables, and rule compliance.
- Proves code structure is sound; does not prove runtime behavior.

### Tier 2: Mocked Verification (`VITE_USE_MOCK=true`)
- Uses `axios-mock-adapter` in development mode (`import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === 'true'`).
- Validates UI component rendering, client-side route transitions, and mock-defined error branches (401/404/409).
- Proves UI handles mock data; **does not prove compatibility with live backend schemas**.

### Tier 3: Live Backend Verification
- Connects to `https://cybermorph-backend.onrender.com/v1`.
- Proves actual end-to-end integration with the FastAPI backend.
- **Trap to Avoid**: An unauthenticated HTTP request returning `401 Unauthorized` only proves the endpoint exists and requires authentication; **it does not prove the authenticated endpoint logic, permissions, or response shapes work correctly**. Never claim an endpoint is verified based solely on a 401 response.

---

## 4. Session & Request Isolation Verification

When modifying `authStore.js`, `playerClassroomStore.js`, or any store dealing with user data:
1. **Account State Cleanup**: Verify that calling `logout()` clears tokens and completely resets all domain stores (`classroomStore`, `threatIndexStore`, `playerClassroomStore`).
2. **Stale Response Protection**: Ensure in-flight asynchronous requests from a previous login or slower request cannot resolve and overwrite newer state after logout or account switching.
3. **No Role Defaulting**: Ensure unverified accounts never fall back to `'player'` or infer privileges on the client.

---

## 5. UI & Responsive Verification Rules

When modifying templates, views, or styles:
1. **Touch Targets**: Confirm touch targets on mobile (`<= 480px`) meet the 44×44px minimum.
2. **Text Zoom Resilience**: Ensure container layouts do not clip, overlap, or truncate critical text when text size is scaled up to 200%.
3. **No Horizontal Scrollbars**: Ensure layout containers and tables wrap or scroll internally rather than inducing horizontal page-level overflow.

---

## 6. Avoiding Redundant Re-runs

- Repeat passing checks only after relevant source files have changed or new evidence requires re-evaluation.
- Reuse existing tools and scripts rather than writing new scripts or runners for routine tasks.
