---
name: writing-guidelines
description: Enforces technical writing, API documentation, domain terminology, and UI copy standards for CyberMorph based on the official API Guide and system architecture. Use when reviewing documentation, writing API guides, verifying UI text and error banners, or checking domain naming consistency.
metadata:
  category: documentation
  version: "2.1.0"
  argument-hint: <file-or-pattern>
---

# CyberMorph Writing & Copy Guidelines

This skill enforces technical writing precision, canonical domain vocabulary, UI messaging standards, and consistency with backend contracts across all documentation, UI text, error banners, and code comments in CyberMorph.

---

## 1. Core Principles

1. **Adhere to the Backend Contract as Source of Truth**: Document only what exists in the backend contract (`C:/Cyber-Morph/cybermorph-backend/API_GUIDE.md` and `docs/api.md`). Do not duplicate full endpoint inventories into secondary skills; refer to `API_GUIDE.md` for live endpoint details.
2. **Concise, Helpful UI Copy**: Keep UI copy clear, actionable, and beginner-friendly. Avoid routine technical error banners or unnecessary jargon. Explain what happened and what action the user should take.
3. **Preserve Data Uncertainty & Semantic Distinctions**:
   - **Missing vs. Zero**: Never render `null` as "0%" or "0". In analytics, `null` means unattempted/no data yet.
   - **Unlocks vs. Proficiency**: Distinguish between Threat Index unlocks (`threat_unlocked_count`, `threat_index`) and actual decision performance (`category_fail_rates`, `threat_events`).
   - **Scores vs. Averages**: Clearly distinguish individual best scores (`best_score_by_map`) from class averages (`avg_best_score_by_map`).
   - **Player Telemetry vs. Research Play Data**: Godot player telemetry (`/analytics/*`) is for classroom instruction; research play-data logs (`/sync/play-data`, `/admin/play-data`) are raw research data for system administrators.
4. **Do Not Attribute All Network Failures to Cold Starts**: Free-tier cloud instances experience a 30–50s cold start after ~15 minutes idle, but client offline states (`navigator.onLine === false`) or immediate connection rejections should not be mislabeled as server wake-ups.

---

## 2. Canonical Domain Terminology & Enums

### User Roles
- **Player**: The game-client account. Enrolls via `POST /auth/register`. Role string: `"player"`.
- **Educator**: Instructor account for the web portal. Registers via `POST /auth/register-web` with required `display_name` and `@dnsc.edu.ph` email. Starts inactive pending admin approval.
- **Admin**: System administrator account. Created strictly via backend provisioning/seeding. **Never describe admin accounts as self-service.**

### The 8 Canonical DICT Threat Categories
Threat categories must appear in this exact canonical order and spelling:
1. `Phishing`
2. `Smishing`
3. `Vishing`
4. `Social Engineering`
5. `Credential Theft`
6. `Public Wi-Fi Attack`
7. `Malware Infection`
8. `Ransomware`

### Canonical Simulation Maps
Maps must be referenced by their exact names and 0-based progression indices (`map_progress` 0–3):
0. `Home` (unlocked on start)
1. `Office`
2. `Internet Cafe`
3. `Public Park`
A map is unlocked when its index <= `map_progress`.

### Session Outcomes
Game session results are restricted to:
- `"win"`
- `"lose"`
- `"timeout"`

---

## 3. UI Messaging Standards

### Friendly Error Translation
Translate raw error payloads into clear, concise, actionable feedback:

| Scenario / Code | UI Writing Guideline | Example |
| :--- | :--- | :--- |
| `401 Unauthorized` | State credentials or session issue without leaking account existence. | *"Invalid email or password."* / *"Session expired. Please sign in again."* |
| `403 Forbidden` | Explain account state or permission boundaries simply. | *"Account pending approval."* / *"Educator access required."* |
| `404 Not Found` | Clearly state the missing item. | *"Classroom not found. Please check the code."* |
| `409 Conflict` | Extract nested `detail.message` and provide resolution steps. | *"You are already in a classroom."* / *"Display name required before creating a class."* |
| `422 Unprocessable` | Point to the specific field requirement. | *"Display name must be between 1 and 100 characters."* |
| Network Timeout | Advise retrying after a brief pause if the server is waking up. | *"Connection timed out. Please try again in a few moments."* |

---

## 4. What NOT to Document or Assume as Active

Do not write guides or UI copy assuming the existence of:
- **Unbuilt Admin Routes**: Modifying or deleting user accounts (`PATCH/DELETE /admin/users/{id}`) and deleted-records log/restore (`/admin/deleted-records`).
- **Web Portal Offline Sync**: Offline sync endpoints (`/sync/*`) are exclusively reserved for Godot mobile game sync.
- **Unbuilt Profile Features**: Profile avatars or self-service password reset.

---

## 5. Review Checklist for Documentation & Copy

When using this skill to review any document or UI copy:
- [ ] Are role names capitalized as Player, Educator, and Admin?
- [ ] Are threat categories using the exact 8 canonical strings?
- [ ] Are map names using Home, Office, Internet Cafe, and Public Park?
- [ ] Is educator registration stated as requiring `@dnsc.edu.ph` and `display_name`?
- [ ] Are error handlers accounting for nested 409 conflict objects?
- [ ] Are network errors described accurately without assuming every failure is a hosting cold start?
- [ ] Are `null` metrics described as "No attempts recorded" rather than "0%"?
