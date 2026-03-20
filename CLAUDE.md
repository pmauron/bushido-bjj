# CLAUDE.md — Bushido BJJ Academy App

## What This Is
A BJJ (Brazilian Jiu-Jitsu) academy management app for children's programs at a multi-location gym in Shanghai. Manages student rosters, attendance, assessments, belt promotions, competition team selection, rankings, and parent-facing reports.

## Architecture

### Single-File React SPA
- **Main app**: `src/App.jsx` (~7,500+ lines) — the entire coach-facing application
- **Parent portal**: `docs/index.html` — vanilla JS, single-file, parent-facing (registration, progress, reports)
- **AI proxy**: `api/comment.js` — Vercel serverless function, proxies to Groq/Llama 3.3 70B for AI coach commentary
- **Entry**: `src/main.jsx` → renders `<App />`
- **Build**: Vite (`vite.config.js`)

### Dual Hosting
- **Vercel** (bushido-bjj.vercel.app): Main coach app. Auto-deploys from `main` branch via GitHub integration. Blocked in China (needs VPN).
- **Cloudflare Pages** (bushido-bjj.pages.dev): Parent portal (`docs/` folder). China-accessible. Build command: empty. Output dir: `docs`.
- Both deploy from same GitHub repo: `pmauron/bushido-bjj`

### Backend: JSONBin (REST API)
All data stored as JSON bins. No database. No auth layer beyond JSONBin master key.

**Bin IDs:**
| Key | Bin ID |
|-----|--------|
| Config | `69a2839943b1c97be9a59cba` |
| Roster | `69a28371ae596e708f516ab3` |
| Assessments | `69a2834a43b1c97be9a59c35` |
| Selections | `69a282fd43b1c97be9a59baa` |
| Attendance | `69a326fe43b1c97be9a7016b` |
| Registrations | `69ba1a16aa77b81da9f49237` |

**JSONBin Master Key:** In `src/App.jsx` and `docs/index.html` (hardcoded).

**JSONBin Constraints:**
- No transactional integrity — reads/writes can race
- Rate limit ~30 req/min on free tier; loading all 6 bins simultaneously triggers 429
- Registrations bin loads with 3-second delay after login to avoid 429
- v3 rejects empty arrays — use `[{ _init: true }]` as placeholder
- Stale in-memory state on another tab can overwrite a fresh delete on next save — close other tabs before deleting

### External Services
- **Groq API** (Llama 3.3 70B): AI coach commentary. Key stored as Vercel env var `GROQ_API_KEY`.
- **Cloudinary** (cloud: `dzghquzxw`, preset: `bushido`): Student photo uploads.
- **GitHub Actions**: Daily backup of all bins to `backups` branch (pruned to 30 snapshots).

## Data Model

### Roster (array of kids)
Each kid: `id` (K-001 format), `name`, `dob`, `weight`, `belt`, `stripes`, `gym`, `active`, `joinDate`, `classCountOffset`, `photoUrl`, `parentName`, `parentPhone`, `parentLang` ("en"|"zh"), `lastPromotionDate`

### Assessments (array)
Each: `kidId`, `cycle` (e.g. "2025-Q1"), `date`, `coach`, `scores` (12 criteria keyed by name), `status` ("pending"|"approved"), `aiComment` ({ en, cn }), `aiCommentHistory`

### Config
`gyms`, `coaches`, `communityMembers`, `belts`, `cycles`, `criteria` (4 categories: BJJ/Athletic/Commitment/Competition, 3 criteria each = 12 total), `scoringWeights`, `promotionRules`, `weightRules`, `classTypes`, `goals`, `activityLog`

### Attendance (array of day records)
Each: `date`, `gym`, `classTypeId`, `records` (array of { kidId, present })

### Selections (object keyed by cycle)
Competition team selections per bracket.

### Registrations (array)
Parent-submitted registrations with status "pending", approved/rejected by admin/master coach.

## Key Patterns

### Roles & Access Control
- **admin**: Full access. Sees all gyms, all features.
- **master**: Master coach. Auto-approves assessments. Sees AI edit history. Can toggle gyms.
- **coach**: Regular coach. Assessments submitted as "pending". Limited to assigned gym.
- **community**: Community member. Read-only roster/attendance for their gym.

### Assessment Scoring
- 12 criteria across 4 categories, each scored 1-5
- Category weights (configurable): BJJ, Athletic, Commitment, Competition
- Weighted final score computed by `computeSubtotals()`
- Rankings: grouped by cycle × age category (U8/U10/U12/U14) × weight category (Light/Heavy)

### Timezone
All dates use `Asia/Shanghai` via `toDateStr()` utility. Never use raw `new Date().toISOString().slice(0,10)`.

### Component Pattern
Tab components are called as functions (`RecordTab()`) NOT rendered as JSX (`<RecordTab />`). Using JSX for inline components causes unmount/remount on every render → focus loss bugs.

### Navigation
Primary tabs: Home, Students, Classes, Score, More (hamburger → Rankings, Promotions, Reports, Settings, Admin Log).

## Styling
- Dark theme (`#0a0a0a` background, `#e8e8e8` text)
- Red accent: `#C41E3A`
- Typography: Bebas Neue for headers
- Category colors per assessment domain
- Mobile-first responsive

## Development Workflow

### How Changes Are Made
1. Edit files via GitHub web UI (github.com) — one file per commit
2. Vercel auto-builds on push to `main`
3. Space out commits — rapid sequential commits cause Vercel build conflicts ("Initializing" stuck state)
4. Cancel stale builds in Vercel dashboard if stuck

### Critical Rules
- **Surgical edits over full rewrites.** Full-file rewrites risk introducing regressions. The codebase is 7,500+ lines — always make targeted changes.
- **Map before modifying.** For complex changes, produce a full change map/audit BEFORE touching code.
- **No unrequested features.** Do not add features beyond the stated scope.
- **Propose → approve → build.** Wait for explicit "green light" or "continue" before implementing.
- **Belt config must be complete.** Belt values in config's `belts` array must exactly match student belt strings or students are silently excluded from charts.
- **Test data shape compatibility.** New data must match what the live deployed app expects — shape mismatches crash the app.

### Navigation in the Codebase
Since it's a single 7,500+ line file, use grep:
```bash
grep -n "function ComponentName" src/App.jsx
grep -n "PATTERN" src/App.jsx
```

### Parent Portal (`docs/index.html`)
Separate vanilla JS app. Has its own copies of:
- `binRead`/`binWrite` functions
- `RUBRIC_HINTS` constant
- `computePromoProjection` function
- Report PDF generation logic

Changes to scoring/report logic must be applied in BOTH files.

## Removed Features (Do Not Rebuild)
- Demo data loader (caused corruption)
- Notes-per-kid (bad idea)
- Separate ProfileScreen (merged into RosterScreen)
- By Coach table in Reports
- By Age Category table in Reports
- Dashboard/Team toggle in Reports
