# Phase 3.2 – Enterprise Product Audit Report

**Status:** Complete (local; not committed)  
**App:** `nextjs-auth` (SRP SmartRecruit)  
**Rule:** No commit/push until explicitly instructed.

## Summary

Phase 3.2 focused on production cleanup: navigation IA, report catalog, Communications Hub reliability, SRP branding/splash, skeleton loaders, and field-label consistency. No net-new product features beyond what existing workflows required.

## Intentional keepers

| Item | Justification |
|------|----------------|
| Candidate stage filters vs Offer & Onboarding | Different workflows (tracker vs offers/joining) |
| Dashboard KPI strip vs Reports export packs | Ops command center vs formal exports |
| ESS vs HRMS | Employee self-service vs admin HR config |
| Offers / Joining / Drop as separate reports | Distinct status slices of the same table, unique purpose |
| Funnel export vs Fill Ratio export | Different columns / metrics |

## Duplicates & actions

| Item | Location | Action | Notes |
|------|----------|--------|-------|
| Pipeline Kanban nav + `KanbanCard` | `dashboard/page.tsx` | Removed | Dead code deleted |
| Analytics nav | sidebar | Hidden → redirect to Reports | |
| My Performance nav | sidebar | Hidden → redirect to Reports | |
| Dual Weekly/Monthly KPI cards | ReportsTab | Merged | Single Recruiter Performance + 7/30/90 toggle |
| AI Screen / Compose / JD / Boolean nav | sidebar | Folded into AI Recruit Copilot modes | Back-links + mode chips |
| Import nav | sidebar | Hidden; Candidates “Import” button | |
| Integrations nav | sidebar | Absorbed into Settings panel | |
| Follow-ups nav | sidebar | Hidden | Still reachable via deep link / Dashboard queues |
| Governance nav | sidebar | Settings → Governance subsection | |
| HR Config label | sidebar / HrConfigTab | Relabeled **HRMS** | Same content |
| Comms Hub empty / silent errors | CommsHubTab + `/api/comm` | Fixed | See Communications |
| Dual email send path | `/api/email/send` | Fixed | Now writes `communication_logs` |
| Zap logo vs brand | login/signup/sidebar | Replaced with BrandMark “S” | Favicon + PWA manifest |

## Navigation (final)

Dashboard → Jobs → Candidates → Clients → Submissions → Interviews → Offer & Onboarding → Recruiters → Documents → Reports → Communications → AI Recruit Copilot → HRMS → ESS → Settings

## Reports catalog

Categories: **Recruitment**, **Performance**, **HR & Compliance**, **Executive**  
New API types: `jobs`, `aging`, `productivity`  
Live **Dashboard Summary** canvas retained at top of Reports.

## Communications Hub

| Issue | Fix |
|-------|-----|
| GET errors → empty `[]` | Return **500** + UI error banner |
| `/api/email/send` skipped logs | `insertCommLog` via `lib/commLog.ts` |
| Blank empty state | Distinguish no provider / never sent / filters / API error + CTAs |
| Raw UUID entity fields | Candidate / Job / Client select pickers |
| Send → list | Immediate refresh after successful send |

Outbound-only (not a live inbound inbox) — documented as remaining recommendation.

## Branding & loading

- `BrandMark` + `AppSplash` (rotating ring, gradient, light/dark-friendly)
- `public/icon.svg`, `icon-192.png`, `icon-512.png`, `favicon.png`, `manifest.webmanifest`
- Metadata icons in `app/layout.tsx`
- Login / signup / sidebar: **SRP SmartRecruit**
- Skeletons: `TableSkeleton`, `CardGridSkeleton`, `FormSkeleton`, `KpiStripSkeleton`
- Applied on Dashboard session load, Workspace, Reports canvas

## Field audit

- Shared labels: `lib/candidateFieldLabels.ts`
- Applied in Add Candidate review labels (NRIC / passport standardized)
- DB column drops: **not done** (documented only)

## Validation

| Check | Result |
|-------|--------|
| `tsc --noEmit` | Pass |
| `npm run lint` | Pass |
| `npm run build` | Pass |

## Remaining recommendations

1. Full inbound email/WhatsApp inbox + real delivery webhooks in production  
2. Encrypt provider secrets at rest  
3. Separate migration review before dropping unused DB columns  
4. Optional: wire Attendance/Leave CSV exports when ESS APIs expose them  
5. Commit + deploy only after explicit approval  

## Files touched (high level)

- `app/dashboard/page.tsx` — nav IA, redirects, branding, splash, dead Kanban removal  
- `components/recruitment/ReportsTab.tsx`, `app/api/reports/route.ts`  
- `components/recruitment/CommsHubTab.tsx`, `app/api/comm/route.ts`, `app/api/email/send/route.ts`, `lib/commLog.ts`  
- `components/ui/BrandMark.tsx`, `components/ui/Skeletons.tsx`, `components/ui/KpiVisuals.tsx`  
- `app/layout.tsx`, `app/login/page.tsx`, `app/signup/page.tsx`, `app/globals.css`  
- `components/recruitment/AiRecruiterWorkspace.tsx`, `HrConfigTab.tsx`, `WorkspaceTab.tsx`, `AddCandidateFlow.tsx`  
- `docs/PHASE_3_2_AUDIT.md` (this file)  
- `public/*` brand assets  
