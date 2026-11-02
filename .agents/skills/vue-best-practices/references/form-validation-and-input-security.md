# Client-Side Form Validation & Input Security Guidelines

## Context & Principles

In educational cybersecurity portals, user onboarding and authentication must be both user-friendly and strictly compliant with security policies:
1. **Password Rule Enforcement**: CyberMorph mandates a minimum 12-character password including uppercase, lowercase, numbers, and special characters (and <= 72 bytes). Submitting invalid credentials causes unnecessary network round-trips and 422 errors.
2. **Institutional Boundaries**: Educator registration (`POST /auth/register-web`) requires an official institutional email ending in `@dnsc.edu.ph` and a required `display_name` (1–100 characters, single line, trimmed).
3. **Client-Side vs. Server-Side Security Distinction**: Rule 3 of `AGENTS.md` explicitly warns:
   > *"Client-side route protection must not be treated as a security boundary. Actual authentication and authorization must be enforced by the FastAPI backend."*
   Client validation exists solely for immediate feedback and improved user experience.
4. **Cross-Site Scripting (XSS)**: Rendering unescaped error strings or usernames via `v-html` or `innerHTML` introduces injection vulnerabilities.

---

## Recommended Architecture & Best Practices

### 1. Client-Side Pre-Validation
Validate format, length, and domain restrictions before sending requests:

```javascript
// Example validation logic in RegisterView.vue
const validateRegistration = ({ role, email, password, username, displayName }) => {
  const trimmedEmail = email.trim()

  // 1. Institutional domain and display name for educators
  if (role === 'educator') {
    if (!trimmedEmail.toLowerCase().endsWith('@dnsc.edu.ph')) {
      return 'Educator registration requires an institutional email ending in @dnsc.edu.ph.'
    }
    const cleanDisplayName = (displayName || '').trim()
    if (!cleanDisplayName || cleanDisplayName.length > 100) {
      return 'Display name is required and must be between 1 and 100 characters.'
    }
  }

  // 2. Username constraints for players
  if (role === 'player') {
    const cleanUsername = (username || '').trim()
    if (cleanUsername.length < 3 || cleanUsername.length > 50) {
      return 'Player username must be between 3 and 50 characters.'
    }
  }

  // 3. Password complexity (12+ characters with character variety)
  if (password.length < 12) {
    return 'Password must be at least 12 characters.'
  }
  const hasUpper = /[A-Z]/.test(password)
  const hasLower = /[a-z]/.test(password)
  const hasDigit = /[0-9]/.test(password)
  const hasSpecial = /[^A-Za-z0-9]/.test(password)

  if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
    return 'Password must contain at least one uppercase letter, one lowercase letter, one digit, and one special character.'
  }

  return null // Valid
}
```

---

### 2. Role-Dependent Form Fields
Submit only the fields the backend endpoint accepts:
- `POST /auth/register` (Player): Accepts `{ email, username, password }`.
- `POST /auth/register-web` (Educator): Accepts `{ email, password, display_name }`.

In your Vue template, render only the fields appropriate for the selected role:

```vue
<!-- Username field for players -->
<div v-if="role === 'player'" class="form-group">
  <label for="username">Username</label>
  <input
    id="username"
    v-model="username"
    type="text"
    placeholder="Player username"
    required
    minlength="3"
    maxlength="50"
    autocomplete="username"
  />
</div>

<!-- Display name field for educators -->
<div v-if="role === 'educator'" class="form-group">
  <label for="displayName">Display name</label>
  <input
    id="displayName"
    v-model="displayName"
    type="text"
    placeholder="Prof. Maria Santos"
    required
    maxlength="100"
    autocomplete="name"
  />
</div>
```

---

### 3. Safe Rendering & XSS Prevention
- **Never use `v-html`**: Always use standard template interpolation `{{ errorMessage }}`. Vue automatically escapes all HTML entities (`<script>`, `<iframe>`, `onerror`), rendering text safely.
- **Never mirror raw exception objects**: Avoid dumping raw error details directly to the template. Use mapped, human-readable strings.

```vue
<!-- Correct: Automatically escaped text -->
<div v-if="errorMessage" class="error-banner" role="alert">
  {{ errorMessage }}
</div>

<!-- FORBIDDEN: Highly vulnerable to stored or reflected XSS -->
<!-- <div v-html="errorMessage"></div> -->
```

---

### 4. Preventing Double Submissions
Always disable the submission button and indicate progress while asynchronous network requests are pending:

```vue
<button
  type="submit"
  class="btn-primary"
  :disabled="isLoading"
  :aria-busy="isLoading"
>
  {{ isLoading ? 'Registering...' : 'Complete registration' }}
</button>
```

---

## Verification Steps

1. Run non-fixing linting:
   ```powershell
   npx oxlint .
   npx eslint .
   ```
2. Verify that attempting to register an educator with `@gmail.com` shows an institutional domain error immediately without sending an HTTP request.
3. Verify that educator registration requires a non-empty `display_name`.
4. Verify that the form submit button is disabled while an asynchronous request is in flight.
