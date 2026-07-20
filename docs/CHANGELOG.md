# Changelog — RC1 → Phase 3.1 readiness

**Branch:** `main`  
**RC tag:** `v1.0.0-rc1` (`28d7463`)  
**Status:** Code ready for Live UAT. Production `v1.0.0` not cut until UAT + backup deploy sign-off.

---

## 1. Security (data isolation)

| Fix | File(s) |
|-----|---------|
| Comm webhook fail-closed in production if `COMM_WEBHOOK_SECRET` missing | `app/api/comm/webhook/route.ts` |
| Interview cancel always scoped by `tenant_id` | `app/api/interviews/[id]/route.ts` |
| Client 360 no longer falls back to all-tenant offers | `app/api/clients/[id]/360/route.ts` |
| Notification create limited to self (`userId = ctx.userId`) | `app/api/notifications/route.ts` |
| Interview PATCH/DELETE require `pipeline.update` | `app/api/interviews/[id]/route.ts` |

---

## 2. Recruitment OS side-effects (timeline · audit · notifications)

Every critical stage now writes OS events where missing before:

| Stage | Timeline | Audit | Notifications | Extra |
|-------|:--------:|:-----:|:-------------:|-------|
| Job create | ✅ | ✅ | ✅ | |
| Candidate create | ✅ | ✅ | ✅ | |
| AI screening | ✅ | ✅ | ✅ | |
| Submission stage change (incl. reject / hold / no-show) | ✅ | ✅ | ✅ | workflow |
| Interview create | ✅ | ✅ | ✅ | |
| Interview status (completed → agent collab) | ✅ | ✅ | ✅ | `runCollaborativeChain` |
| Offer create / status | ✅ | ✅ | ✅ | reminders |

---

## 3. AI Copilot

- Intent modes: JD, WhatsApp, compare, boolean, compose, market, **docs**, **joining**, search, sourcing, chat
- RAG adds **document gaps** and **joining this week**
- System prompt: Senior Recruitment Director (tenant data first)

---

## 4. Performance

| Change | Detail |
|--------|--------|
| Candidate list aggregates | SQL `GROUP BY` (no full-table JS scan) |
| Offers list doc slots | Single batch query (no N+1) |
| Indexes | `db/migrate_v27_perf_indexes.sql` |

---

## 5. Deploy safety (cloud)

| Change | Detail |
|--------|--------|
| Required pre-deploy backup | `scripts/srp-backup.sh` → `/usr/local/bin/srp-backup` |
| Tracked migrations v22–v27 | `scripts/apply-tracked-migrations.sh` (was missing after v21 in CI) |
| Login guard | Abort if `auth_users` count changes during tracked migrate |
| App-only recreate | DB volume untouched |

---

## 6. Documentation (rewritten, structured)

- `docs/INDEX.md`
- `docs/OPERATIONS.md` (expanded)
- `docs/PHASE_3_1_LIVE_UAT.md`
- `docs/CHANGELOG.md` (this file)
- `VALIDATION_RC1.md`, `PHASE2_AUDIT.md`, `fullrecuruitmentOS.md`, `README.md` aligned

---

## 7. Explicitly not done yet

- Live UAT sign-off for Scenarios 1–5
- Production tag `v1.0.0`
- Push / deploy (requires your approval after backup)
