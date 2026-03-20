# Bushido BJJ

Academy management platform for children's Brazilian Jiu-Jitsu programs. Built for multi-location gyms in Shanghai.

## Architecture

```
Parents (China, no VPN)          Coaches (VPN)
        │                              │
        ▼                              ▼
  Cloudflare Pages               Vercel (SPA)
  docs/index.html                src/App.jsx
        │                              │
        └──────────┬───────────────────┘
                   ▼
              JSONBin (REST API)
              ┌─────────────────┐
              │ config           │
              │ roster           │
              │ assessments      │
              │ selections       │
              │ attendance       │
              │ registrations    │
              └─────────────────┘
                   │
              Cloudinary (photos)
```

## Stack

| Layer | Tech | Notes |
|-------|------|-------|
| Frontend | React (Vite), single-file SPA | `src/App.jsx` (~7,300 lines) |
| Parent registration | Static HTML | `docs/index.html`, hosted on Cloudflare Pages |
| API proxy | Vercel serverless function | `api/comment.js` (Groq/Llama AI commentary) |
| Data | JSONBin (6 bins) | Config, roster, assessments, selections, attendance, registrations |
| Photos | Cloudinary | Cloud `dzghquzxw`, unsigned preset `bushido` |
| Backups | GitHub Actions | Daily snapshot of all bins to `backups` branch (last 30 kept) |

## Hosting

### Main app → Vercel
- Auto-deploys from `main` branch via GitHub integration
- Requires VPN in China (Vercel is blocked by GFW)
- Used by coaches and admins

### Parent registration form → Cloudflare Pages
- Serves `docs/index.html` as a static site
- Accessible in China without VPN (Cloudflare has China CDN via JD Cloud partnership)
- URL: `bushido-bjj.pages.dev`
- Auto-deploys from `main` branch, output directory: `docs`

### Why two hosts?
Vercel's edge network is blocked by China's Great Firewall. The parent registration form must be accessible to parents in Shanghai without VPN. Cloudflare Pages provides China-accessible hosting for the static form, while the main React app stays on Vercel (coaches use VPN).

## JSONBin Bins

| Bin | ID | Purpose |
|-----|----|---------|
| Config | `69a2839943b1c97be9a59cba` | Gyms, coaches, belts, cycles, scoring weights, promotion rules |
| Roster | `69a28371ae596e708f516ab3` | Student records |
| Assessments | `69a2834a43b1c97be9a59c35` | Quarterly scoring data |
| Selections | `69a282fd43b1c97be9a59baa` | Competition team picks |
| Attendance | `69a326fe43b1c97be9a7016b` | Class attendance records |
| Registrations | `69ba1a16aa77b81da9f49237` | Parent-submitted registrations (pending approval) |

## Parent Registration Flow

1. Parent scans QR code or opens `bushido-bjj.pages.dev`
2. Bilingual form (EN/CN toggle) collects: name, DOB, weight, gym, belt, stripes, photo, parent contact, preferred language
3. Duplicate check: if phone + DOB match an existing registration or roster entry, submission is blocked
4. Photo uploads to Cloudinary; form data writes to the registrations JSONBin bin with `status: "pending"`
5. Coach app loads registrations (3-second delayed fetch to avoid JSONBin rate limits)
6. Admin or master coach sees pending count on Home screen notification + Roster tab badge
7. Approve → kid created in roster with next available ID. Reject → removed from registrations bin

### Access control for approvals
- **Admin**: sees all pending registrations
- **Master coach**: sees only registrations for their assigned gym
- **Regular coach / community**: no access to pending registrations

## Repo Structure

```
bushido-bjj/
├── .github/workflows/
│   └── backup.yml          # Daily JSONBin backup to backups branch
├── api/
│   └── comment.js          # Vercel serverless: Groq AI commentary proxy
├── docs/
│   └── index.html          # Parent registration form (Cloudflare Pages)
├── src/
│   ├── App.jsx             # Main SPA (all components)
│   └── main.jsx            # React entry point
├── index.html              # Vite entry
├── package.json
└── vite.config.js
```

## Deployment

All changes are committed via the GitHub web UI. No local Node.js or CLI.

### To update the main app:
Edit `src/App.jsx` in GitHub → commit to `main` → Vercel auto-builds

### To update the registration form:
Edit `docs/index.html` in GitHub → commit to `main` → Cloudflare Pages auto-deploys

### Deployment notes:
- Space out sequential commits — rapid pushes can cause Vercel build conflicts
- Prefer fewer, larger commits over many small ones
- Cloudflare Pages deploys are fast (~30s) and independent of Vercel

## Key Features

- **Roster management**: student profiles, photos, belt/stripe tracking, multi-gym support
- **Attendance**: class scheduling with capacity, check-in recording, frequency tracking
- **Assessments**: 12-criteria rubric across 4 categories (BJJ, Athletic, Commitment, Competition), quarterly cycles, approval workflow
- **AI commentary**: Groq/Llama-powered coach notes per assessment, with edit/retranslate/history
- **Rankings**: bracket-sorted by age category and weight class
- **Competition team**: selection management per cycle
- **Parent reports**: shareable via unguessable token links, bilingual, with radar chart and attendance history
- **Promotion projection**: stripe/belt readiness based on class count and time-at-belt
- **Reporting**: hero metrics, roster health charts, attendance insights, class fill rates
- **Parent registration**: China-accessible form with coach approval workflow

## Roles

| Role | Access |
|------|--------|
| Admin | Full access, all gyms, approve registrations/assessments |
| Master Coach | Full access to assigned gym, approve registrations/assessments for their gym |
| Coach | Score assessments (pending approval), record attendance |
| Community | View-only roster and attendance |

## Locations

- Jing'An (静安)
- Xuhui (徐汇)
- Minhang (闵行)
