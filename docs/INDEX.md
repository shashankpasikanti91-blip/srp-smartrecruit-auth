# SmartRecruit documentation index

Clean, structured docs for operators and developers. Prefer these over ad-hoc notes.

| Document | Purpose |
|----------|---------|
| [README.md](../README.md) | Product overview, local setup, env vars |
| [OPERATIONS.md](./OPERATIONS.md) | Backups, tenant safety, deploy runbook, login preservation |
| [PHASE_3_1_LIVE_UAT.md](./PHASE_3_1_LIVE_UAT.md) | Live UAT scenarios (MY/IN/SG + drop branches + AI + UI + perf + security) |
| [CHANGELOG.md](./CHANGELOG.md) | What changed from RC1 → Phase 3.1 readiness |
| [../PHASE2_AUDIT.md](../PHASE2_AUDIT.md) | Phase 2 / 2.5 / 3 capability audit |
| [../VALIDATION_RC1.md](../VALIDATION_RC1.md) | RC1 go/no-go scorecard |
| [../fullrecuruitmentOS.md](../fullrecuruitmentOS.md) | Recruitment OS vision ↔ implementation map |

## Release policy

| Tag | Meaning |
|-----|---------|
| `v1.0.0-rc1` | Internal release candidate (keep) |
| `v1.0.0` | Production only after Phase 3.1 Live UAT pass + backup + deploy sign-off |

## Golden rules

1. **Never** drop tenant / auth data to “fix” deploy.
2. **Always** run `srp-backup` before production migrate/rebuild.
3. Migrations must be **additive** (`IF NOT EXISTS`, indexes, widen CHECKs only).
4. App rebuild stops **app only** — Postgres volume `srp_auth_pgdata` stays up.
5. No commit / push / tag / deploy without explicit owner approval.
