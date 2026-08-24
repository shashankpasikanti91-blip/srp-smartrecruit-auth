# SmartRecruit Auth — Release 1.1.0

Local-only until you approve deploy. **Do not deploy to production until approved.**

## Changes
- **Deep RAG**: chunk → embed → pgvector (`rag_chunks`) → tenant-scoped retrieve
- **Light loop**: retrieve → answer with citations → one retry if weakly grounded (`ragAnswerLoop`); coach uses the same rewrite+verify once on the answer path
- **Light graph**: `talent_edges` (skills / screened_for) boosts internal match
- **APIs**: `POST /api/rag/reindex` (admin/owner), `POST /api/rag/query` (`loop: true` for citation loop)
- **Write hooks**: index resume/job on create/update (candidate POST/PATCH, job create/PATCH, screen save); soft-fail if pgvector/embeddings unavailable
- **Hybrid wire**: Coach appends vector passages to SQL RAG; internal match `0.6*vector + 0.3*token + 0.1*graph` when vectors exist
- Embeddings via existing OpenRouter/OpenAI keys; `EMBEDDING_MODEL` default `openai/text-embedding-3-small` (1536 dims)
- Agentic AI / Coach structure **not** rewritten — retrieval injection only

## Schema
- Migration: `db/migrate_v36_rag_graph.sql` (`vector` extension, `rag_chunks`, `talent_edges`)
- Requires Postgres with **pgvector**

## Local verify
```bash
cd nextjs-auth
# Postgres with pgvector (local):
docker compose -f docker-compose.pgvector.yml up -d
# Point DATABASE_URL at localhost:5436 (user srp_ats / db srp_auth — see compose file)
npx tsx scripts/run-migrations.ts
npm run dev
# Optional smoke:
npx tsx scripts/smoke-rag.ts
npx tsx scripts/smoke-rag-index.ts   # needs AI key; inserts a sample resume
```

1. Confirm health / version shows **1.1.0**
2. As admin/owner: `POST /api/rag/reindex` with `{ "source": "all", "dry_run": true }` then without dry_run
3. `POST /api/rag/query` with `{ "q": "...", "loop": true }` — expect chunks / citations
4. Coach still answers; internal match still returns ranks if embeddings/pgvector missing (best-effort)

## Env
- `EMBEDDING_MODEL` (optional) — default `openai/text-embedding-3-small`
- Same OpenRouter/OpenAI keys already used for chat

## Deploy later (do not run until approved)
Tag previous image, build, tag `1.1.0-YYYYMMDD`, up app. Confirm host Postgres has `pgvector` before migrate (compose `db` image is now `pgvector/pgvector:pg16` — new volumes only; existing volume without the extension still needs a one-time `CREATE EXTENSION`).
