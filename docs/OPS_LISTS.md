# Ops Lists — SRP SmartRecruit (Phase 3.2+)

Clear entity IDs + dense ops tables for **Submissions**, **Interviews**, and **Offer & Onboarding**.

## ID convention

| Prefix | Label | Click opens |
|--------|--------|-------------|
| RES- | Cand. ID | Candidate 360 |
| SUB- | Submission ID | Submission detail drawer |
| INT- | Interview ID | Interview edit / feedback |
| OFF- | Offer ID | Offer open / docs panel |

Shared UI: `components/ui/EntityIdLink.tsx`, `components/recruitment/OpsListChrome.tsx`, `lib/datePresets.ts`, `lib/opsList.ts`.

## Column maps

### Submissions
Cand. ID · Name · Client / Project · Position · Recruiter · Submitted · Feedback date · Feedback status · Detail · Recorded by · Actions

### Interviews
Cand. ID · 1st Date · 1st Time · 2nd Date · 2nd Time · Name · Phone · Email · Client / Project · Position · Exp. · Current Sal. · Expected Sal. · Feedback · Actions

### Selected & Docs
Emp./Cand. ID · Name · Contact · Email · Client / Project · Position · Exp · Current Sal. · Expected Sal. · Interview feedback · Docs status · Slots filled · Actions (Docs / View)

**Docs** opens `DocsUploadPanel` → `POST /api/candidates/[id]/documents` (real file upload per slot).

### HR & Offer
Open · Emp / Cand. ID · Name · Client (Full) · Position · Contact · Email · Exp · Current Sal. · Expected Sal. · DOJ · HR discussion · Budget OK · Offer letter · Joined status · Joined date · HR Ops

HR meta stored in `offer_cases.salary_breakdown.hr_ops` (no schema migration).

## Tenant scope

- Recruiter: default `mine=1` (own rows)
- Owner/admin: full tenant + optional “My work only”
- All queries use `requireTenant` + `tenant_id`

## APIs

| Route | Notes |
|-------|--------|
| `GET /api/submissions` | date_from/to, feedback bucket, mine, summary counts |
| `GET /api/submissions/export` | CSV / XLSX |
| `GET /api/interviews` | date filters, mine, profile exp/salary |
| `GET /api/interviews/export` | CSV / XLSX |
| `GET /api/offers` | docs_status, hr_ops, interview feedback lateral |
| `PATCH /api/offers/[id]` | docs_status, hr_discussion, budget_ok, offer_letter, joined_* |
| `GET /api/offers/export` | CSV / XLSX |

## E2E

```bash
npm run test:e2e:auth -- e2e/authenticated/ops-lists.spec.ts
```

Live HTTPS smoke still runs in GitHub Actions deploy workflow after push to `main`.
