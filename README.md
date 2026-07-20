# SRP AI Labs — SmartRecruit (Next.js app)

**Live:** https://recruit.srpailabs.com  
**Release:** `v1.0.0-rc1` (internal) · Production `v1.0.0` after [Phase 3.1 Live UAT](docs/PHASE_3_1_LIVE_UAT.md)  
**Stack:** Next.js 16 · NextAuth v4 · PostgreSQL · Tailwind CSS · TypeScript

> AI-powered **Recruitment Operating System** — pipeline, jobs, candidates, multi-country documents, offers, AI Copilot, multi-tenant isolation.

**Documentation index:** [docs/INDEX.md](docs/INDEX.md)  
**Operations / backups / safe deploy:** [docs/OPERATIONS.md](docs/OPERATIONS.md)  
**What changed (RC1 → 3.1):** [docs/CHANGELOG.md](docs/CHANGELOG.md)  
**Product vision map:** [fullrecuruitmentOS.md](fullrecuruitmentOS.md)

Full monorepo context (FastAPI backend, deployment): see the repository root [README.md](../README.md). **This folder is the production SmartRecruit web app.**

---

## Features (May–Jul 2026)

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
| **Recruitment OS** | Submissions, interviews, offers, timelines, audit, reminders, Candidate/Client/Job 360, HR country packs |
| **AI Copilot** | Senior recruiter intents (JD, boolean, compare, WhatsApp, missing docs, joining) |
| **Owner panel** | Admin: users, activity, token usage, subscriptions |
| **Notifications** | In-app center + Telegram/email on signup/login/errors (when configured) |
| **Deploy** | Docker + nginx + Let’s Encrypt; GitHub Actions CI/CD with **required pre-deploy backup** |

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

1. Create a PostgreSQL database (e.g. Supabase or Docker `srp-auth-db`).
2. Run base schema if greenfield: `db/schema.sql`.
3. Apply migrations in order. Production deploy uses `scripts/apply-tracked-migrations.sh` (`v0` + `v14`–`v27`) **after backup**.
4. Never reset the Postgres volume to “fix” schema — that destroys all tenants.

---

## Environment variables

| Variable | Where | Description |
|---|---|---|
| `NEXTAUTH_SECRET` | server | Random 32-byte base64 string |
| `NEXTAUTH_URL` | server | Full public URL (e.g. `https://recruit.srpailabs.com`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | server | Google OAuth |
| `DATABASE_URL` | server | Postgres connection string |
| `COMM_WEBHOOK_SECRET` | server | Required in production for `/api/comm/webhook` |
| `OPENAI_API_KEY` / `OPENROUTER_API_KEY` | server | AI Copilot + screening |
| `OWNER_EMAILS` / `NEXT_PUBLIC_PLATFORM_OWNER_EMAILS` | server/client | Platform owner allow-list |

See `.env.example` / `.env.production` for the full list (SMTP, Telegram, Supabase, etc.).

---

## Safe production deploy

1. Complete [Phase 3.1 Live UAT](docs/PHASE_3_1_LIVE_UAT.md).  
2. Owner approves commit / push.  
3. CI runs **required backup** → additive migrations (through v27) → rebuild **app only** (DB volume untouched).  
4. Verify `/api/health`, login, and existing tenant candidates still present.

Details: [docs/OPERATIONS.md](docs/OPERATIONS.md).

---

## API routes (high level)

| Route | Method | Description |
|---|---|---|
| `/api/auth/[...nextauth]` | GET/POST | NextAuth |
| `/api/health` | GET | `{ ok: true }` |
| `/api/jobs` | GET/POST | Jobs; POST accepts `optional_requirements` |
| `/api/candidates` | GET/POST | Tenant-scoped list / create |
| `/api/candidates/[id]` | PATCH | Pipeline, profile, scores |
| `/api/candidates/[id]` | DELETE | Remove candidate (tenant-guarded) |
| `/api/screen` | POST | AI screening |
| `/api/coach` | POST | AI Recruiter Copilot |
| `/api/submissions`, `/api/interviews`, `/api/offers` | various | Recruitment OS modules |
| `/api/admin` | GET | Owner stats (when authorized) |

---

## Architecture

```
recruit.srpailabs.com
    → Nginx (TLS)
    → Docker Next.js app (127.0.0.1:3010)
    → PostgreSQL volume srp_auth_pgdata (all tenants — never wipe)
```

---

## Entity IDs

| Entity | Format |
|---|---|
| User | `USR-…` |
| Job | `JOB-…` |
| Candidate | `RES-…` |
| Submission | `SUB-YYYY-######` |
| Interview | `INT-…` |
| Offer | `OFF-YYYY-######` |

---

## Owner account

Platform owners use `OWNER_EMAILS` / `NEXT_PUBLIC_PLATFORM_OWNER_EMAILS`. Do not commit secrets or production `.env` files.
