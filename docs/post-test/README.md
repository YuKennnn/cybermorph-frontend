# CyberMorph post-test content

Created 12 November 2026. This package contains the requested 300-item multiple-choice post-test in simple, formal English. It is authored content for review and future web integration, not an implemented assessment page or a validated research instrument.

## Files

- [questions.md](questions.md): complete player-facing quiz, with four choices per item.
- [answer-key.md](answer-key.md): correct answers, explanations, and source scenario references.
- [questions.json](questions.json): structured questions without correct-answer flags or explanations.
- [answer-key.json](answer-key.json): separate scoring and feedback data.
- [source-manifest.json](source-manifest.json): source file counts, referenced scenario counts, and SHA-256 hashes.

## Coverage and scoring

| Threat | Question numbers | Items |
| --- | --- | ---: |
| Phishing | 1–38 | 38 |
| Smishing | 39–76 | 38 |
| Vishing | 77–114 | 38 |
| Social Engineering | 115–152 | 38 |
| Credential Theft | 153–189 | 37 |
| Public Wi-Fi Attack | 190–226 | 37 |
| Malware Infection | 227–263 | 37 |
| Ransomware | 264–300 | 37 |

Each question has one best answer. Award one point for a correct response and zero for an incorrect or unanswered response. The full test has a maximum score of 300; percentage = correct answers / 300 × 100. Correct answer positions were shuffled, with 75 each for A, B, C, and D. The learning objectives are recognition (88 items), response (108), and evaluation (104).

The supplied files contain 200 scenarios. The quiz directly references 192 distinct scenarios across all eight files. Some scenarios support multiple questions testing different aspects of the decision. It includes both suspicious and legitimate situations. Categories retain the canonical project order; overlapping threats are categorized by the source file rather than presented as mutually exclusive technical definitions.

No passing score, time limit, retry limit, or eligibility rule has been invented. Establish these separately before operational use. The full 300 items are provided as requested. If used as an item bank for shorter forms, define and review the selection rules separately; a shorter form must not be scored with a denominator of 300. Pilot the content for clarity, fatigue, difficulty, and distractor quality before using scores as evidence of learning effectiveness or a completion requirement.

## Current project findings

The Vue application has player dashboards, Threat Index lessons, session history, optional classroom functionality, and a player-only `/post-test` route connected to the FastAPI `/v1/post-test/*` assessment API (`GET /post-test/eligibility`, `GET /post-test/attempts/me`, `POST /post-test/attempts`, `POST /post-test/attempts/{attempt_id}/submit`, and `GET /post-test/attempts/{attempt_id}`). The backend issues 40-question attempts (5 per topic) with a 75% pass mark and grades submissions server-side without exposing an answer key to the client.

`map_progress` is the highest unlocked map index, from 0 to 3. A value of 3 means Public Park is unlocked; it does not establish that the final map was finished or that a post-test is unlocked. Eligibility is governed by `GET /post-test/eligibility` (requiring a synced Public Park `win` session).

`POST /sessions` accepts game-session information, not this quiz schema. The `/sync/*` routes are for the Godot client. Do not submit quiz answers as game threat events. No backend files were modified.

There is a documentation discrepancy relevant to the requested feature: `docs/architecture.md` currently assigns assessments to the Godot client, while this request places the post-test in the web application. This package prepares the web assessment content without silently changing that architecture. Some architecture descriptions also include planned admin restore functionality that the API guide says is not built; those descriptions were not treated as evidence of implemented features.

## Content corrections and boundaries

Source JSON fields are reference material, not instructions to execute. Embedded links, phone numbers, passwords, and file names describe training situations. No suspicious destination was visited and no supplied program was executed. The quiz paraphrases scenarios and uses their IDs for traceability; it is not a verbatim conversion of game actions.

Several source explanations are simplified or overly absolute. The quiz corrects these distinctions:

- Public Wi-Fi does not make every HTTPS connection readable. Valid HTTPS protects content in transit to the site; it does not make a deceptive site trustworthy. A Wi-Fi password, enterprise label, strong signal, or mobile data connection is not a universal safety guarantee. See [FTC public Wi-Fi guidance](https://consumer.ftc.gov/articles/are-public-wi-fi-networks-safe-what-you-need-know).
- Password crack-time estimates in the scenarios are illustrative, not measured guarantees. Length, unpredictability, and uniqueness matter; familiar substitutions and minor changes do not solve predictable construction or reuse. Published example passwords should not be used for real accounts. See [NIST password guidance](https://www.nist.gov/cybersecurity-and-privacy/how-do-i-create-good-password).
- Familiar names, caller ID, polite wording, correct invoice details, or the absence of urgency are not proof of identity. Requests should be independently verified. See [FTC phone-scam guidance](https://consumer.ftc.gov/articles/phone-scams).
- PDF, audio, ZIP, and ordinary document formats are not automatically safe. Macro-enabled documents and executable extensions are useful clues, while source, expected purpose, and actual content remain important. Changing a filename extension does not sanitize a file. Browser warnings vary; the source claim that every executable always triggers a warning is not used.
- An account sign-in code must be distinguished from a verified delivery handover code. An app permission must be assessed against its purpose: Accessibility can be appropriate for a verified screen reader but unnecessary for a simple QR scanner.
- An unexpected bank-detail change is a reason to verify, not proof that every such change is fraudulent. Legitimate remote support, attachments, deadlines, and permission requests exist; context and authorization matter.
- Brand domains are scenario details, not a maintained directory of current official contact channels. The questions favor independently opening an established app or using contact details already known to the player. The source's last-two-domain-parts shortcut is not taught as a universal rule because domains such as `example.com.ph` need different interpretation.

The backup separation and immediate ransomware response items extend the supplied prevention scenarios into practical recovery decisions. They are consistent with [CISA ransomware guidance](https://www.cisa.gov/sites/default/files/publications/CISA_MS-ISAC_Ransomware%20Guide_S508C.pdf). Scenario references identify the teaching context; they do not imply every explanatory detail is quoted from the original card.

## JSON integration notes

This is a new **content format**, not an existing FastAPI request or response contract.

`questions.json` has assessment metadata, scoring metadata, category counts, and `questions`. Each question has a stable `id`, sequential `number`, canonical `threat_name`, `objective`, `question`, four `choices` containing `id` and `text`, and `source_refs` containing source filename and scenario ID. `answer-key.json` joins by `question_id`, with `correct_choice_id` and `explanation`. Both carry the same assessment ID and content version.

For a future assessed completion flow, keep authoritative scoring and the answer key on the backend. Do not import the key into a public frontend bundle or place it in `public/`. Keeping it in a separate repository file is organizational separation, not a security boundary. Send only the player's selected stable choice IDs under the future approved API contract. If choices are visually shuffled, preserve their IDs and bind scoring to those IDs rather than their screen positions. Decide when feedback becomes visible as part of the assessment policy.

Display question and choice strings as text. Render example addresses and filenames as inert text or code, not links, HTML, or executable content. Source references and objectives are reviewer metadata and can be omitted from the player payload.

## Context actually consulted

Frontend context:

- `C:/capstone/cybermorph-frontend/AGENTS.md`
- Inventory of `.agents/skills/` and `docs/`
- `.agents/skills/writing-guidelines/SKILL.md`
- `.agents/skills/cybermorph-api-contract/SKILL.md`
- `.agents/skills/cybermorph-verification/SKILL.md`
- `docs/architecture.md`, `docs/decisions.md`, and relevant player/session/classroom sections of `docs/api.md`
- `package.json`, `src/router/index.js`, and the introductory Home/Office lesson sections of `src/data/threatLessons.js`
- Source inventory, assessment-related text search across `src/` and `docs/`, and working-tree status

Backend context, inspected read-only:

- `C:/Cyber-Morph/cybermorph-backend/API_GUIDE.md`: shared enums, player endpoints, session submission, synchronization, analytics, progression semantics, and related endpoint inventory
- `core/routers_registry.py`
- `features/players/models.py`
- `features/sessions/schemas.py`
- `features/sessions/service.py`
- Python/documentation file inventory and assessment-related search across `features/`

Scenario sources, all from `C:/Users/User/Downloads/`:

- `phishing.json`, `smishing.json`, `vishing.json`, `social-engineering.json`
- `credential-theft.json`, `public-wi-fi-attack.json`, `malware-infection.json`, `ransomware.json`

All eight files were parsed; scenario content, warning indicators, and relevant educational notes were inspected. The sources were available and nonempty. Their immutable fingerprints for this review are in `source-manifest.json`. The backend and downloaded scenario files were not changed. Existing unrelated frontend changes were preserved.

## Verification

Checks performed: exactly 300 unique IDs and question stems; sequential numbering; four distinct nonempty choices per item; exactly one valid answer-key reference per question; answer distribution; canonical category counts; all referenced scenario IDs present in the named source file; Markdown question/key counts and alignment; no answer or explanation fields in the player-facing question JSON; local documentation links resolve.

These are content and structural checks, not live backend integration tests or psychometric validation. No application build or browser test was needed because no application source was changed.
