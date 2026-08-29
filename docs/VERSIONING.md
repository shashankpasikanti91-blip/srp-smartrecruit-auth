# Versioning — App vs DB vs V2 Requirements

**Do not confuse these three.**

| Concept | Meaning | Where it lives | Example |
|---------|---------|----------------|---------|
| **V2 requirements baseline** | Engineering / capability requirements (HOW + WHAT gap driver) | [`version2.md`](../version2.md), [`docs/UNIVERSAL_MASTER_ENGINEERING_STANDARD.md`](../../docs/UNIVERSAL_MASTER_ENGINEERING_STANDARD.md) | “V2” = requirements **only** — not an app release |
| **Application version** | Shipable product semver | [`package.json`](../package.json) `version`, `/api/health` → `application.version`, `APP_VERSION` env | **1.3.0** code baseline → **1.4.0** next |
| **Database migration level** | Additive schema scripts | `db/migrate_vN.sql` + [`lib/runMigrations.ts`](../lib/runMigrations.ts) | **migrate_v41** ≠ Application V41 |

## Current identity (repo)

| Layer | Value |
|-------|--------|
| V2 | Requirements baseline (`version2.md`) |
| Application (code) | See `package.json` (target train: 1.3.0 → **1.4.0**) |
| Production GA tag (historical) | `v1.0.0` (2026-07-28) — confirm live deploy separately before assuming 1.3/1.4 is in prod |
| DB (repo) | Highest: `migrate_v41_*` |
| Gap tracker | [`docs/master/V2-Applicability-Matrix.md`](../../docs/master/V2-Applicability-Matrix.md) |

## Rules

1. **Never** rebuild or reset the app to “V2.”
2. **Never** treat `migrate_vN` as the application version.
3. **Never** invent version numbers (no fake “V45” app labels). Next app version follows semver from `package.json`.
4. If the current app is better than a V2 sketch, **preserve** the current implementation and mark the requirement ALREADY_IMPLEMENTED or PARTIAL.
5. Compare: V2 requirements → against **current app version** → enhance → **next app version**.

## Release train (semver)

```text
v1.0.0   Production GA tag
  → 1.2.0 / 1.3.0   Code baseline (Deep RAG / Job·Candidate 360 polish)
    → 1.4.0         V2-requirements gap closure on top of 1.3.0
```

See also: [RELEASE-1.3.0.md](RELEASE-1.3.0.md) · [RELEASE-1.4.0.md](RELEASE-1.4.0.md) · [RAG-PRODUCTION-GATE.md](RAG-PRODUCTION-GATE.md).
