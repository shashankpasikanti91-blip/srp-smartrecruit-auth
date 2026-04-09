# SRP AI Labs — SmartRecruit

**Live:** https://app.srpailabs.com  
**Stack:** Next.js 16 · NextAuth v4 · Supabase · Tailwind CSS · TypeScript

> Agentic AI recruiting platform — source, match, engage, and manage talent.

---

## Features

| Feature | Description |
|---|---|
| Google OAuth | One-click sign-in via NextAuth + Google Cloud |
| Pipeline Kanban | Drag candidates through Sourced → Applied → Screening → Interview → Offer → Hired |
| AI Match Scoring | Best / Good / Partial / Poor match badges driven by AI scores |
| Unique IDs | Every job (`JOB-000001`), candidate (`RES-000001`), user (`USR-000001`) gets a searchable short ID |
| Candidate Search | Filter by name, email, stage, match category, job |
| Owner Panel | Full admin view — users, activity log, token usage, subscriptions |
| Telegram + Email | Real-time notifications on signup, login, errors |
| Production Ready | Docker + nginx + Let's Encrypt SSL + GitHub Actions CI/CD |

---

## Quick Start (Local)

```bash
cd nextjs-auth
npm install
# copy and fill in .env.local
cp .env.example .env.local
npm run dev
# open http://localhost:3000
```

---

## Database Setup (Supabase)

1. Open [Supabase Dashboard SQL Editor](https://supabase.com/dashboard/project/xtixlhodoqvfopuukhjt/editor)
2. Run `db/schema.sql` (creates all 7 base tables)
3. Run `db/migrate_v2.sql` (adds human-readable IDs, pipeline stages, candidates table)

---

## Environment Variables

| Variable | Where | Description |
|---|---|---|
| `NEXTAUTH_SECRET` | server | Random 32-byte base64 string |
| `NEXTAUTH_URL` | server | Full URL (`https://app.srpailabs.com`) |
| `GOOGLE_CLIENT_ID` | server | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | server | From Google Cloud Console |
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | server | Supabase service role key (never expose) |
| `TELEGRAM_BOT_TOKEN` | server | Bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | server | Chat/user ID for notifications |
| `OWNER_EMAIL` | server | Owner email address |
| `SMTP_USER` / `SMTP_PASS` | server | Gmail + App Password |

---

## Deploy to Hetzner

### One-time setup
```bash
# SSH into server
ssh deploy@5.223.67.236

# Clone and deploy
git clone https://github.com/SRP-AI-Labs/srp-smartrecruit-auth /opt/srp-smartrecruit-auth
cd /opt/srp-smartrecruit-auth
bash deploy.sh
```

### DNS record
Add an `A` record in Cloudflare / your DNS provider:
```
app.srpailabs.com  →  5.223.67.236
```

### GitHub Actions (automatic deploy on push to main)
Add these secrets in GitHub → Settings → Secrets:
| Secret | Value |
|---|---|
| `HETZNER_HOST` | `5.223.67.236` |
| `HETZNER_USER` | `deploy` |
| `HETZNER_SSH_KEY` | Private SSH key (no passphrase) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `PRODUCTION_ENV` | Full contents of `.env.production` (filled) |

### Manual redeploy
```bash
cd /opt/srp-smartrecruit-auth
git pull && docker compose up -d --build
```

---

## Architecture

```
app.srpailabs.com (Cloudflare)
    │
    ▼
Nginx on Hetzner 5.223.67.236  (port 443 SSL)
    │
    ▼ 127.0.0.1:3010
Docker: srp-auth-app  (Next.js 16, port 3000)
    │
    ├─► Supabase (PostgreSQL) — all data
    ├─► Google OAuth — authentication
    ├─► Telegram Bot — owner notifications
    └─► Gmail SMTP — email notifications
```

> **Other projects on Hetzner (srp-ats on port 8009, mediflow, n8n) are completely isolated and unaffected.**

---

## API Routes

| Route | Method | Description |
|---|---|---|
| `/api/auth/[...nextauth]` | GET/POST | NextAuth OAuth handler |
| `/api/health` | GET | Health check → `{ok: true}` |
| `/api/jobs` | GET/POST | List / create job posts |
| `/api/candidates` | GET/POST | List / create candidates (with pipeline filter) |
| `/api/candidates/[id]` | PATCH | Update pipeline stage, score, notes |
| `/api/resumes` | GET/POST | Resume management |
| `/api/resumes/[id]` | PATCH | Update resume status |
| `/api/admin` | GET | Owner stats, users, activity log |
| `/api/notify/test` | POST | Send test Telegram + email alert |

---

## Entity IDs

Every record has both a UUID (internal) and a human-readable short ID:

| Entity | ID Format | Example |
|---|---|---|
| User | `USR-000001` | `USR-000042` |
| Job Post | `JOB-000001` | `JOB-000007` |
| Resume / Candidate | `RES-000001` | `RES-000123` |

---

## Owner Credentials
Owner account: **pasikantishashank24@gmail.com**  
First sign in with Google → automatically gets `role=owner`.
