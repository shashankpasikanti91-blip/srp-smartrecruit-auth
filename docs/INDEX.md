# SmartRecruit documentation index

Clean, structured docs for operators and developers. Prefer these over ad-hoc notes.

| Document | Purpose |
|----------|---------|
| [README.md](../README.md) | Product overview, local setup, env vars |
| [VERSIONING.md](./VERSIONING.md) | App semver vs DB migrate_vN vs V2 requirements |
| [RELEASE-1.4.0.md](./RELEASE-1.4.0.md) | App 1.4.0 — V2-requirements gap closure on 1.3.0 |
| [RAG-PRODUCTION-GATE.md](./RAG-PRODUCTION-GATE.md) | pgvector / RAG prod readiness evidence |
| [OPERATIONS.md](./OPERATIONS.md) | Backups, tenant safety, deploy runbook, login preservation |
| [PHASE_3_2_AUDIT.md](./PHASE_3_2_AUDIT.md) | Phase 3.2 enterprise audit (nav, reports, branding) |
| [OPS_LISTS.md](./OPS_LISTS.md) | SRP ops tables: ID clarity, columns, docs upload, exports |
| [CHANGELOG.md](./CHANGELOG.md) | What changed from RC1 → Phase 3.1 readiness |
| [../PHASE2_AUDIT.md](../PHASE2_AUDIT.md) | Phase 2 / 2.5 / 3 capability audit |
| [../VALIDATION_RC1.md](../VALIDATION_RC1.md) | RC1 go/no-go scorecard |
| [../fullrecuruitmentOS.md](../fullrecuruitmentOS.md) | Recruitment OS vision ↔ implementation map |

## Release policy

| Tag / version | Meaning |
|---------------|---------|
| `v1.0.0-rc1` | Internal release candidate (keep) |
| `v1.0.0` | Production GA (2026-07-28) |
| `1.3.0` | Code baseline — Deep RAG / 360 polish |
| `1.4.0` | V2-requirements gap closure (current package target) |

**V2** in `version2.md` is a **requirements baseline**, not an app release.

## Golden rules

1. **Never** drop tenant / auth data to “fix” deploy.
2. **Always** run `srp-backup` before production migrate/rebuild.
3. Migrations must be **additive** (`IF NOT EXISTS`, indexes, widen CHECKs only).
4. App rebuild stops **app only** — Postgres volume `srp_auth_pgdata` stays up.
5. No commit / push / tag / deploy without explicit owner approval.
