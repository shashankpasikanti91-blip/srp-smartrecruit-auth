# SmartRecruit Auth — Release 1.3.0

Local-only until you approve deploy. **Do not deploy to production until approved.**

## Theme
**Job 360 / Candidate 360 polish** — make the hiring desk feel like an OS (vs HireEZ search-only), with Deep RAG “why” on the surface.

## Changes
- **Job 360 Overview:** Top internal matches strip (score + explain from Deep RAG hybrid)
- **Job 360 Pipeline:** Stage counts **plus** people boards (open Candidate 360 by name)
- **`GET /api/jobs/[id]/360`:** adds `pipeline_board` (candidates per stage)
- **Candidate 360:** “Deep match & AI on record” card — linked-job explain + AI summary
- **Internal Matches:** clearer Why affordance (explain already on row)

Builds on **1.2.0** Coach citations + Settings reindex + match explain API.

## Local verify
```bash
cd nextjs-auth
npm run dev
```

1. Health / version **1.3.0**
2. Open a job → Overview → Top internal matches  
3. Job → Pipeline → names under stages  
4. Open a candidate linked to a job → teal Deep match card  
5. Settings → Deep RAG index still works (1.2)

## Deploy later (do not run until approved)
Tag `1.3.0-YYYYMMDD` after pgvector + v36 + reindex (same as 1.1/1.2).
