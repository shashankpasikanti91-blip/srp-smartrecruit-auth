# RAG production gate (App 1.4.0)

Deep RAG ships in App **1.3.0+**. Production claim requires evidence below.  
`migrate_v36` / `migrate_v41` are **database** levels — not application versions. See [VERSIONING.md](VERSIONING.md).

## Required before calling RAG “production ready”

| Check | How | Pass criteria |
|-------|-----|---------------|
| pgvector extension | `SELECT extname FROM pg_extension WHERE extname='vector'` | Row present |
| `rag_chunks` table | `\dt rag_chunks` or information_schema | Exists |
| Migrations | Apply through **migrate_v41** via `runMigrations` | v36–v41 applied |
| Health / status | `GET /api/health` (public) + `GET /api/rag/status` (admin/owner) | `health.rag.status === 'ready'` and admin status `vector_ready: true` |
| Fixture eval | `npm run test:rag-eval` | Exit 0 (does **not** prove live retrieval quality) |
| Live smoke | `npx tsx scripts/smoke-rag.ts` against staging/prod DB | Tenant-scoped hits + citations |
| Reindex | Settings → Deep RAG reindex for one tenant | Chunk counts > 0 |

## Soft-skip behaviour

Local/dev without pgvector may skip `rag_chunks` creation. That is **NOT_PROD_READY**.  
Set `ENVIRONMENT=production` and treat missing vector as a deploy blocker when RAG is in scope (`RAG_REQUIRED` defaults on — see `lib/rag/readiness.ts`).

## Security (already in 1.3.0 — preserve)

Authorize → `tenant_id` filter → permission filter → retrieve (`lib/rag/retrieve.ts`). Never reverse that order.
