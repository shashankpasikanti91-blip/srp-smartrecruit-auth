# SRP AI Labs — SmartRecruit (Next.js app)

**Live:** https://recruit.srpailabs.com  
**Stack:** Next.js 16 · NextAuth v4 · PostgreSQL (Supabase or self-hosted) · Tailwind CSS · TypeScript

> Production dashboard and API for agentic recruiting: pipeline, jobs, candidates, AI screening, compose, analytics, multi-tenant isolation.

Full monorepo context (FastAPI backend, deployment): see the repository root [README.md](../README.md). **This folder is the production SmartRecruit web app** — keep unrelated third-party app trees out of the repository root.

---

## Features (May 2026)

| Area | Description |
|---|---|
| **Google OAuth** | Sign-in via NextAuth + Google Cloud |
| **Multi-tenant** | `requireTenant()` on API routes; data scoped by `tenant_id`. Duplicate email checks and duplicate UI are **per workspace only** — never merged across tenants |
| **Uploader on candidates** | GET `/api/candidates` includes `uploaded_by` (name/email from `auth_users`) for who added each resume row in this workspace |
| **Team tenure (policy)** | UI documents a **3‑month** in-workspace tenure guideline for admin review of primary ownership on shared duties (display-only; not enforced by cron) |
| **Pipeline Kanban** | Drag candidates through Sourced → Applied → Screening → Interview → Offer → Hired |
| **AI screening** | Single CV, bulk upload, or “from candidates” (reuses stored text). Persists structured `ai_screening_data` + numeric `ai_score`. Optional/nice-to-have skills in JD match when a job is linked |
| **JD-linked screening** | `POST /api/screen` with `job_post_id` merges tenant job `description`, `requirements`, and `optional_requirements` into the model prompt |
| **Match badges** | Best / Good / Partial / Poor from score; handles string scores from the model |
| **Short IDs** | Human-readable IDs (`JOB-…`, `RES-…`, `USR-…`) alongside UUIDs |
| **Candidate dossier** | `candidate_profile` JSONB (salary, notice, location, visa, masked IDs, notes). Dashboard: dossier column, Kanban badge, modal summary + **ATS record** tab + phone save |
| **Jobs** | Create/list jobs with `optional_requirements` for AI context |
| **Owner panel** | Admin: users, activity, token usage, subscriptions |
| **Notifications** | Telegram + email on signup, login, errors (when configured) |
| **Deploy** | Docker + nginx + Let’s Encrypt; GitHub Actions CI/CD |

---

## Quick start (local)

```bash
cd nextjs-auth
npm install
cp .env.example .env.local
# Fill DATABASE_URL, NEXTAUTH_*, GOOGLE_*, etc.
npm run dev
# http://localhost:3000
```

Typecheck:

```bash
npx tsc --noEmit
```

### E2E tests (Playwright)

Deeper checks: **API** (`/api/health`, tenant routes return **401** without a session), **public pages** (login/signup), **guest redirect** from `/dashboard`, and **accept-invite** without a token.

```bash
cd nextjs-auth
npm install
npx playwright install chromium   # once per machine / CI image

# Local (run `npm run dev` in another terminal)
npm run test:e2e

# Production or staging (PowerShell)
$env:PLAYWRIGHT_BASE_URL="https://recruit.srpailabs.com"; npm run test:e2e

# Fixed production URL (Windows CMD, macOS, Linux — uses cross-env)
npm run test:e2e:live
```

**Authenticated E2E** (optional): signs in with the Credentials provider, saves session to `e2e/.auth/user.json` (gitignored), and runs `e2e/authenticated/**/*.spec.ts` in the `chromium-authenticated` project.

- Copy [.env.e2e.example](.env.e2e.example) to `.env.e2e.local` (gitignored via `.env.*.local`) and set `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` for a user that can sign in with email/password (active account, tenant membership).
- By design, login is **not** run against a non-local `PLAYWRIGHT_BASE_URL` unless you set `E2E_ALLOW_REMOTE_AUTH=1` (avoids accidental production sign-in).
- Run only authenticated specs: `npm run test:e2e:auth` (still requires the env above; `npm run test:e2e` runs both guest and authenticated projects when configured).

Lightweight HTTPS smoke (no browser): from repo root, `python deployment/e2e_live_check.py` — includes **`/api/health`** for the Next app.

---

## Database setup

1. Create a PostgreSQL database (e.g. Supabase).
2. Run base schema if this is a greenfield project: `db/schema.sql` (creates core tables).
3. Apply **migrations in order** from `db/` (see list in root [README.md](../README.md) § Database Migrations). At minimum after v9, apply:
   - `migrate_v10_invite_hardening.sql` — invite flow indexes and cleanup
   - **`migrate_v10_candidate_record_optional_jd.sql`** — `resumes.candidate_profile` JSONB + `job_posts.optional_requirements`
   - `migrate_v11_dup_index.sql` — index on `(tenant_id, candidate_email)` for duplicate checks

Supabase: SQL Editor → paste each file → Run.

---

## Environment variables

| Variable | Where | Description |
|---|---|---|
| `NEXTAUTH_SECRET` | server | Random 32-byte base64 string |
| `NEXTAUTH_URL` | server | Full public URL (e.g. `https://recruit.srpailabs.com`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | server | Google OAuth |
| `DATABASE_URL` | server | PostgreSQL connection string |
| `OPENAI_API_KEY` | server | Used by `/api/screen` and other AI routes (see code) |
| `NEXT_PUBLIC_SUPABASE_URL` | public | Optional; if you use Supabase client-side |
| `SUPABASE_SERVICE_ROLE_KEY` | server | Optional; server-only |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | server | Owner notifications |
| `OWNER_EMAIL` | server | Owner account email |
| `SMTP_USER` / `SMTP_PASS` | server | Email alerts (e.g. Gmail app password) |

Use `.env.example` as the checklist for your deployment.

---

## API routes (high level)

| Route | Method | Description |
|---|---|---|
| `/api/auth/[...nextauth]` | GET/POST | NextAuth |
| `/api/health` | GET | `{ ok: true }` |
| `/api/jobs` | GET/POST | Jobs; POST accepts `optional_requirements` |
| `/api/candidates` | GET/POST | Tenant-scoped list / create |
| `/api/candidates/[id]` | PATCH | `pipeline_stage`, `status`, `reviewer_notes`, `ai_score`, `ai_summary`, `job_post_id`, **`candidate_phone`**, **`candidate_profile`** (object → JSONB) |
| `/api/candidates/[id]` | DELETE | Remove candidate (tenant-guarded) |
| `/api/screen` | POST | AI screening; body may include `job_post_id`, resume text or candidate ids |
| `/api/resumes`, `/api/resumes/[id]` | various | Resume CRUD |
| `/api/admin` | GET | Owner stats (when authorized) |
| `/api/notify/test` | POST | Test Telegram + email |

---

## Architecture

```
recruit.srpailabs.com (Cloudflare)
    │
    ▼
Nginx (443 TLS)
    │
    ▼
Docker: Next.js app (this package)
    │
    ├─► PostgreSQL — tenants, jobs, resumes, screening JSON
    ├─► Google OAuth
    ├─► OpenAI-compatible API — screening / compose
    ├─► Telegram / SMTP — notifications
    └─► Optional: Supabase for hosting DB
```

---

## Entity IDs

| Entity | Format | Example |
|---|---|---|
| User | `USR-000001` | `USR-000042` |
| Job | `JOB-000001` | `JOB-000007` |
| Resume / candidate | `RES-000001` | `RES-000123` |

---

## Deploy (Hetzner) — summary

One-time server setup, DNS `A` record, GitHub Actions secrets (`HETZNER_*`, `PRODUCTION_ENV`, etc.) are documented in deploy scripts and the root README. Typical redeploy:

```bash
cd /opt/srp-smartrecruit-auth
git pull && docker compose up -d --build
```

---

## Owner account

First Google sign-in for the configured owner email receives `role=owner` (see app logic / seed). Do not commit secrets or production `.env` files.
