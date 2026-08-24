# SmartRecruit Auth — Release 1.2.0

Local-only until you approve deploy. **Do not deploy to production until approved.**

## Theme
**Make Deep RAG visible to recruiters** — proof vs ChatGPT / HireEZ-style “we already use AI.”

## Changes
- **Settings → Deep RAG index** (admin/owner): status tiles, dry-run, reindex batch
- **`GET /api/rag/status`**: vector readiness + chunk/source counts
- **Coach citations**: `/api/coach` returns `citations[]` + `grounded_citations`; AiRecruiterWorkspace shows “From your talent data”
- **Internal match explain**: each row includes `explain` (vector / token / graph + plain-language why)
- Builds on **1.1.0** chunk → embed → pgvector → retrieve (unchanged core)

## Local verify
```bash
cd nextjs-auth
docker compose -f docker-compose.pgvector.yml up -d   # if needed
npm run dev
```

1. Health / version shows **1.2.0**
2. Settings (admin): Deep RAG index → Dry run → Reindex now
3. Coach: ask about a candidate/skill → citations panel under answer (when corpus indexed)
4. Job 360 → Internal Matches → “Why: …” under each row
5. `npm run test:e2e -- --project=chromium` (guest suite — previously green)
6. `npm run test:e2e:auth` — login works; expect most nav/smoke pass. Filter/count tests may fail on a thin restored local DB (not RAG regressions).

## Deploy later (do not run until approved)
Confirm host Postgres has **pgvector**, migrate v36, reindex tenant corpus, then tag `1.2.0-YYYYMMDD`.
