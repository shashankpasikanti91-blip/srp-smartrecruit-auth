# RC1 validation scorecard

**Date:** 2026-07-20  
**Tag:** `v1.0.0-rc1` (`28d7463`)  
**Next gate:** [Phase 3.1 Live UAT](docs/PHASE_3_1_LIVE_UAT.md)  
**Production tag `v1.0.0`:** not created until UAT + backup deploy sign-off

Full change list: [docs/CHANGELOG.md](docs/CHANGELOG.md)  
Ops / backup: [docs/OPERATIONS.md](docs/OPERATIONS.md)

---

## Verdict

| Gate | Result |
|------|--------|
| RC1 code freeze | Pass (tagged) |
| Security hotfixes + OS write gaps | Pass (in working tree / pending commit) |
| Live UAT Scenarios 1–5 | **Not signed off** |
| Production deploy | **NO-GO** until Phase 3.1 Pass |

---

## Scorecard

| Area | Status |
|------|--------|
| E2E OS writes (timeline / audit / notify) | Improved — live UI walkthrough still required |
| Multi-country MY / IN / SG | Code ready — live packs required |
| AI Copilot intents | Code ready — recruiter scoring required |
| Mobile `/m` | Partial (approvals + KPIs; 360 via responsive desktop) |
| Security | Critical holes fixed; residual RBAC gaps acceptable for UAT |
| Performance | Aggregates + v27 indexes; load test in UAT |

---

## Blocking for `v1.0.0`

1. Complete [Phase 3.1 Live UAT](docs/PHASE_3_1_LIVE_UAT.md) with three sign-offs.  
2. Production backup via `srp-backup` before migrate/rebuild.  
3. Explicit approval to commit remaining fixes, push `main`, tag, deploy.

---

## Product priority after go-live

Smooth navigation · fast loads · consistent UI · clear workflows · reliable AI — not more features.
