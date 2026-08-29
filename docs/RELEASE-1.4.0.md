# SmartRecruit Auth — Release 1.4.0

Built on **1.3.0** (Deep RAG / Job·Candidate 360). Does **not** reset to V2.

**V2** = requirements baseline only. **1.4.0** = application target for V2-requirements gap closure.  
See [VERSIONING.md](VERSIONING.md) and [V2 Requirements Gap Matrix](../../docs/master/V2-Applicability-Matrix.md).

## Theme

**Version identity + V2-requirements gap closure** on top of App 1.3.0 — preserve working 1.3.0 behaviour; enhance only where the matrix says PARTIAL / NEEDS_IMPROVEMENT / NOT_PROD_READY.

## Changes vs 1.3.0

### Docs / versioning
- `docs/VERSIONING.md` — app semver vs DB `migrate_vN` vs V2 requirements
- Gap matrix rewritten: V2 requirements × App 1.3.0 with 8-way classification
- UMES + `version2.md` banners: never treat V2 as the codebase

### Security / RBAC
- Tenant roles: `recruitment_head`, `manager`, `team_lead`, `hr` presets + invite dropdown
- High-risk audit fail-closed (`logAuditStrict`)
- Expanded authz / IDOR e2e coverage

### Navigation
- Collapsible Recruitment / AI Hub / Operations (preserve 1.3.0 routes & look)

### Communications
- WhatsApp **Meta Cloud** SoT (Twilio legacy kept)
- Provider save → `not_tested`; Connected only after successful Test
- SMS / LinkedIn messaging remain honest FUTURE stubs

### Database / analytics / RAG
- `migrate_v40_analytics_views.sql` — Power BI–ready facts/dims (filter by `tenant_id`)
- `migrate_v41_rag_meta.sql` — RAG meta helper
- RAG readiness probe + fixture eval (`npm run test:rag-eval`)
- Agents remain recommend-only (no LangGraph)

### QA / CI
- `npm run test:unit` — permissions, redaction, audit risk
- PR workflow `.github/workflows/ci.yml` — tsc, lint, unit, rag-eval, secret scan, critical audit

## Explicitly not in 1.4.0
- LangGraph, SMS/LinkedIn live, Power BI embed, AV sandbox, FastAPI rewrite

## Verify
```bash
cd nextjs-auth
npm run test:unit
npm run test:rag-eval
npx tsc --noEmit
```
1. `/api/health` → `application.version` **1.4.0**
2. Integrations: saved WhatsApp shows not Connected until Test succeeds
3. Settings → RAG status exposes readiness when pgvector missing
4. Sidebar: Recruitment / AI Hub / Operations collapse

## DB
Apply through **migrate_v41** (independent of app 1.4.0).  
`migrate_v41` is **not** Application V41.

## Deploy
Local/staging first. Confirm whether production is still **v1.0.0** before promoting 1.4.0.  
Tag only after owner approval (e.g. `1.4.0-YYYYMMDD`).
