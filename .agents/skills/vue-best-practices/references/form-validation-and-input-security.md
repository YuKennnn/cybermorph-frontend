# Client-Side Form Validation & Input Security Guidelines

## Context & Problem Statement

In educational cybersecurity portals, user onboarding and authentication must be both user-friendly and strictly compliant with security policies:
1. **Password Rule Enforcement**: CyberMorph mandates a minimum 12-character passcode including uppercase, lowercase, numbers, and special characters (and <= 72 bytes). Submitting invalid credentials causes unnecessary network round-trips and obscure 422 errors.
2. **Institutional Boundaries**: Educator registration (`POST /auth/register-web`) requires an official institutional domain (`@dnsc.edu.ph`).
3. **Client-Side vs. Server-Side Security Distinction**: Rule 3 of `AGENTS.md` explicitly warns:
   > *"Client-side route protection must not be treated as a security boundary. Actual authentication and authorization must be enforced by the FastAPI backend."*
   Client validation exists solely for immediate feedback and improved user experience.
4. **Cross-Site Scripting (XSS)**: Rendering unescaped error strings or user codenames via `v-html` or `innerHTML` introduces injection vulnerabilities.

---

## Recommended Architecture & Best Practices

### 1. Client-Side Pre-Validation
Validate format, length, and domain restrictions before sending Axios requests:

```javascript
// Example validation logic in RegisterView.vue
const validateRegistration = ({ role, email, password, username }) => {
  const trimmedEmail = email.trim()

  // 1. Institutional domain rule for educators
  if (role === 'educator' && !trimmedEmail.toLowerCase().endsWith('@dnsc.edu.ph')) {
    return 'Educator registration requires an institutional email ending in @dnsc.edu.ph.'
  }

  // 2. Codename constraints for players
  if (role === 'player') {
    if (!username || username.trim().length < 3 || username.trim().length > 50) {
      return 'Player codename must be between 3 and 50 characters.'
    }
  }

  // 3. Password complexity (12+ characters with character variety)
  if (password.length < 12) {
    return 'Passcode must be at least 12 characters.'
  }
  const hasUpper = /[A-Z]/.test(password)
  const hasLower = /[a-z]/.test(password)
  const hasDigit = /[0-9]/.test(password)
  const hasSpecial = /[^A-Za-z0-9]/.test(password)

  if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
    return 'Passcode must contain at least one uppercase letter, one lowercase letter, one digit, and one special character.'
  }

  return null // Valid
}
```

---

### 2. Role-Dependent Form Fields
Do not submit fields the backend endpoint does not accept.
- `POST /auth/register` (Player): Accepts `{ email, username, password }`.
- `POST /auth/register-web` (Educator): Accepts `{ email, password }` only (username and role are omitted).

In your Vue template, conditionally hide irrelevant fields:

```vue
<!-- Only prompt for codename on player accounts -->
<div v-if="role === 'player'" class="form-group">
  <label for="username">Agent Codename (Username)</label>
  <input
    id="username"
    v-model="username"
    type="text"
    placeholder="AgentZero"
    required
    minlength="3"
    maxlength="50"
    autocomplete="username"
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
  {{ isLoading ? 'Initializing Identity...' : 'Complete Registration' }}
</button>
```

---

## Verification Steps

1. Attempt registering an educator with `@gmail.com` and verify the institutional domain error appears immediately without an HTTP request.
2. Attempt registering with a short password (<12 characters) and verify the complexity requirement message appears.
3. Verify that the form submit button is disabled while the request is in flight.
4. Pass special characters (`<script>alert(1)</script>`) in error messages and verify they are safely escaped as plain text.
