# Current Task: Public Leaderboard

## Task
Implement the public Leaderboard view (`LeaderboardView.vue`), configure the public `/leaderboard` route, add navigation access from `DashboardView.vue`, and extend the mock backend (`src/api/mock.js`) with a paginated, filterable `GET /leaderboard` endpoint.

## Objective
Provide an interactive, publicly accessible leaderboard allowing users and guests to view player rankings, search by username with debouncing, filter by map name, and navigate through paginated scores.

## Scope

### In Scope
- Mock data endpoint in `src/api/mock.js`:
  - `GET /leaderboard` supporting `map_name`, `search`, `page`, `page_size`, and returning `total_count` and `items`.
- Views:
  - `src/views/LeaderboardView.vue` (rank table, debounced search, map selector, loading/empty states, pagination controls).
- Routing:
  - `src/router/index.js` (public route `/leaderboard`).
- Navigation:
  - `src/views/DashboardView.vue` (link to `/leaderboard`).

### Out of Scope
- Real backend integration
- Score editing/deletion
- Detailed player profile popups/modals
- Modifications to `src/api/client.js`

## Security & Architecture Rules
- `/leaderboard` is a public route and must not require authentication.
- API communication must flow through `src/api/client.js`.
- Debouncing must be used on user search inputs to prevent excessive network requests.

## Verification Checklist
1. `npm run lint` passes with 0 errors and 0 warnings.
2. `npm run build` completes successfully.
3. Accessing `/leaderboard` unauthenticated works without redirect.
4. Searching by username filters results after a 300ms debounce.
5. Filtering by map name updates table results.
6. Previous/Next pagination buttons navigate pages correctly.
7. Empty state is displayed when no records match.
8. Leaderboard link in Dashboard navigates to `/leaderboard`.