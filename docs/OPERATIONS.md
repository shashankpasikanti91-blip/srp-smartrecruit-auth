# SmartRecruit — operations, security, backups, retention

This document is the **source of truth** for how we run the product safely: tenant isolation, who can access the owner console, client data protection, subscription retention messaging, and backups. Read it before every production deploy.

## 1. Multi-tenant isolation (no cross-workspace leaks)

- API routes that touch jobs, candidates, or uploads must use **`requireTenant()`** from `lib/tenant.ts` and **`tenant_id`** in SQL `WHERE` clauses (see `app/api/candidates/route.ts` as the reference pattern).
- A failure in one route must **not** return another tenant’s data: prefer **401/403** or empty scoped results over guessing tenant.
- Client-facing errors stay **generic**; details and stack traces belong in **server logs** only.

## 2. Platform owners (Shashank, Harish, Priya, …)

There are two different “owner” concepts:

| Concept | Meaning |
|--------|--------|
| **Workspace `owner` role** | `tenant_members.role = owner` for *that* tenant only. Full control inside that workspace. |
| **Platform operator** | May open **`/owner`** and **`/api/admin`** (cross-tenant read for support). Controlled by env, not by vibe. |

**Environment variables**

| Variable | Where | Purpose |
|----------|--------|---------|
| `OWNER_EMAILS` | Server | Comma-separated emails allowed for **`/api/admin`**. |
| `NEXT_PUBLIC_PLATFORM_OWNER_EMAILS` | Client + server | Same list (or subset) for **`/owner`** UI redirect; Next.js only exposes `NEXT_PUBLIC_*` to the browser. |
| `NEXT_PUBLIC_OWNER_EMAIL` | Legacy | Single email; still merged if set. |

Set `OWNER_EMAILS` and **`NEXT_PUBLIC_PLATFORM_OWNER_EMAILS` to the same comma-separated list** so server and client stay aligned. Example:

```bash
OWNER_EMAILS="shashank@example.com,harish@example.com,priya@example.com"
NEXT_PUBLIC_PLATFORM_OWNER_EMAILS="shashank@example.com,harish@example.com,priya@example.com"
```

Use real addresses in deployment secrets—do not rely on defaults in code.

## 3. Client workspaces (Harish, Priya) — no accidental data loss

**Never** run bulk `DELETE` across `resumes` / `job_posts` without scoping to a single tenant and without an explicit ticket.

1. **Database flag (preferred)**  
   After migration `db/migrate_v13_tenant_retention_exempt.sql`, set for the client tenant row:

   ```sql
   UPDATE tenants SET retention_exempt = TRUE WHERE slug IN ('harish-workspace', 'priya-workspace');
   ```

   Use the actual `slug` or `id` from your database.

2. **Environment belt-and-suspenders**  
   `SRP_PROTECTED_TENANT_IDS` — comma-separated **tenant UUIDs**. Any future automated purge job **must** skip these IDs (see `lib/dataRetention.ts`).

## 4. Subscription retention policy (UX + future automation)

Implemented in **`lib/dataRetention.ts`** and exposed on **`GET /api/profile`** as `subscription.retention`:

- **Monthly** billing: **1 month** grace after `current_period_end` before data would be *eligible* for automated cleanup (policy only today—no cron deletes in this repo).
- **Yearly** billing: **3 months** grace after `current_period_end`.

The dashboard shows an **amber banner** when `retention.banner` is non-null (grace or post-grace messaging). **Free** plans do not show purge messaging.

Constants: `RETENTION_GRACE_MONTHS_MONTHLY`, `RETENTION_GRACE_MONTHS_YEARLY`.

**Important:** Purge jobs are **not** implemented here on purpose. When you add a cron or worker, it must:

1. Skip `tenants.retention_exempt = TRUE`.
2. Skip IDs in `SRP_PROTECTED_TENANT_IDS`.
3. Log every tenant touched and require a dry-run mode first.

Example dry-run stub: `db/retention_dry_run.example.sql`.

## 5. Backups (mandatory)

- **PostgreSQL:** scheduled logical dumps (e.g. nightly `pg_dump` with rotation) and tested restores at least quarterly.
- **File uploads:** `uploads/` (e.g. `uploads/candidate-resumes/`) must live on a **persistent volume** and be included in backup or replicated object storage.
- **Secrets:** back up env / secret manager definitions separately; never commit `.env.local`.

## 6. Billing / payments (current product stance)

- **No in-app card payment** is wired. The upgrade modal states that users should **email the team** to subscribe or renew.
- Marketing pages should continue to point to **contact** / **mailto**, not a fake checkout.

## 7. Pre-deploy checklist

1. `npm run lint`
2. `npm run build`
3. Optional: `npm run test:e2e` with `PLAYWRIGHT_BASE_URL` and demo credentials in `.env.e2e.local` (see `playwright.config.ts`).
4. Apply any new SQL under `db/` to production **after backup**.
5. Smoke: `/`, `/login`, `/api/health`, sign-in, open **Pipeline** and **Candidates**.

## 8. Change log (high level)

| Area | Notes |
|------|--------|
| Tenant SQL | All tenant-scoped APIs use `tenant_id` with `requireTenant`. |
| Platform access | `lib/platformAccess.ts` + `OWNER_EMAILS` / `NEXT_PUBLIC_PLATFORM_OWNER_EMAILS`. |
| Retention UX | `lib/dataRetention.ts` + profile `subscription.retention` + dashboard banner. |
| Client protection | `retention_exempt` column + `SRP_PROTECTED_TENANT_IDS`. |
| Lint / build | ESLint 9 flat config; `next build` typecheck. |

Update this table when you ship materially new behaviour.
