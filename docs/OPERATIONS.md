# SmartRecruit — operations, security, backups, retention

Source of truth for safe production operation. Read before every cloud deploy.

Related: [INDEX.md](./INDEX.md) · [PHASE_3_1_LIVE_UAT.md](./PHASE_3_1_LIVE_UAT.md) · [CHANGELOG.md](./CHANGELOG.md)

---

## 1. Multi-tenant isolation

- API routes use **`requireTenant()`** and SQL `WHERE tenant_id = $N`.
- Fail closed: **401/403**, never another tenant’s rows.
- Client errors stay generic; stacks only in server logs.

---

## 2. Platform owners vs workspace owners

| Concept | Meaning |
|---------|---------|
| Workspace `owner` | `tenant_members.role = owner` for that tenant only |
| Platform operator | `/owner` + `/api/admin` via env allow-list |

| Variable | Purpose |
|----------|---------|
| `OWNER_EMAILS` | Server allow-list for `/api/admin` |
| `NEXT_PUBLIC_PLATFORM_OWNER_EMAILS` | Client allow-list for `/owner` |
| `NEXT_PUBLIC_OWNER_EMAIL` | Legacy single email (merged if set) |

Keep server and public lists aligned.

---

## 3. Client workspaces — no accidental data loss

**Never** bulk-delete `resumes` / `job_posts` without a single-tenant ticket and owner consent.

1. Set `tenants.retention_exempt = TRUE` for protected clients (after `migrate_v13`).
2. Set `SRP_PROTECTED_TENANT_IDS` to those UUIDs.
3. Any future purge job must skip both, support dry-run, and log every tenant.

See `lib/dataRetention.ts` and `db/retention_dry_run.example.sql`.

---

## 4. Subscription retention (policy only)

Exposed on `GET /api/profile` → `subscription.retention`.

- Monthly: 1 month grace after period end  
- Yearly: 3 months grace  

**No automated purge is implemented.** Do not add deletes without dry-run + consent.

---

## 5. Backups (mandatory before every production deploy)

### Script

```bash
# On server (after code pull)
sudo cp /opt/srp-smartrecruit-auth/scripts/srp-backup.sh /usr/local/bin/srp-backup
sudo chmod +x /usr/local/bin/srp-backup
sudo /usr/local/bin/srp-backup
```

Creates under `/var/backups/srp-smartrecruit/<UTC-stamp>/`:

| File | Contents |
|------|----------|
| `srp_auth.dump` | Custom-format `pg_dump` (all tenants) |
| `srp_auth.sql.gz` | Plain SQL dump |
| `uploads.tar.gz` | Resume / document files (if present) |
| `row_counts.txt` | Tenant / user / job / candidate counts |
| `env_keys.txt` | Env **key names only** (no secrets) |
| `MANIFEST.txt` | Stamp + file list |

Retention default: **14 days** (`SRP_BACKUP_KEEP_DAYS`).

### What backup never does

- No `DROP` / `TRUNCATE` / mass `DELETE`
- No rewriting of user passwords (except demo account rules in legacy v12, which only touch known-bad hashes)
- No deletion of Docker volume `srp_auth_pgdata`

### Restore (emergency only — requires explicit owner approval)

```bash
# Prefer restore into a new DB first, then cut over
gunzip -c /var/backups/srp-smartrecruit/<stamp>/srp_auth.sql.gz \
  | docker exec -i srp-auth-db psql -U srp_auth -d srp_auth
```

---

## 6. Migrations (additive only)

Tracked list (also in `scripts/apply-tracked-migrations.sh` and `lib/runMigrations.ts`):

`v0`, `v14` … `v27` (includes Phase 2 / 2.5 / 3 schema + perf indexes).

Rules:

1. Run **backup** first.
2. Apply with `ON_ERROR_STOP=1`.
3. Script aborts if **`auth_users` count changes**.
4. App container may restart; **DB container and volume stay up**.

Legacy early patches (`v10`–`v13`) remain in the GitHub deploy workflow and are idempotent.

---

## 7. Deploy runbook (cloud — no data loss)

Live: https://recruit.srpailabs.com  
Host app dir: `/opt/srp-smartrecruit-auth`  
Compose: app on `127.0.0.1:3010`; DB volume `srp_auth_pgdata`.

### Order of operations

1. **Approve** deploy in chat / ticket (owner).
2. Ensure Phase 3.1 UAT passed (or staging deploy only).
3. Push `main` (triggers `.github/workflows/deploy.yml`) **or** manual SSH deploy.
4. Workflow / operator must:
   - Pull code (preserves `.env` and `uploads/`)
   - Run **required** `srp-backup`
   - Write `.env` from secrets (preserves `NEXTAUTH_URL`, `DATABASE_URL`)
   - Apply migrations via `apply-tracked-migrations.sh`
   - Verify login accounts still active + have password hashes
   - Stop/rebuild **app only** (`docker compose stop app` — DB stays)
   - Health-check `/api/health` = 200
   - Smoke login + dashboard + one candidate open

### Abort conditions

- Backup failed and `ALLOW_DEPLOY_WITHOUT_BACKUP` is not `1`
- `auth_users` count changed after migrate
- Health check never returns 200
- Login smoke fails

### Login preservation

- Do not reset Postgres volume.
- Do not run destructive SQL against `auth_users` / `tenant_members`.
- `migrate_v12_fix_passwords.sql` only resets **demo** password and known-bad hashes; custom passwords are kept.
- NextAuth sessions may need re-login after deploy (normal); **accounts and tenant memberships must remain**.

---

## 8. Pre-deploy checklist

1. [ ] Backup completed; path recorded  
2. [ ] `npm run lint` / `npx tsc --noEmit` / `npm run build` on CI  
3. [ ] New SQL under `db/` reviewed (additive only)  
4. [ ] `COMM_WEBHOOK_SECRET` set in production  
5. [ ] Smoke: `/`, `/login`, `/api/health`, Pipeline, Candidates  
6. [ ] Confirm existing tenant data still visible after deploy  

---

## 9. Billing stance

No in-app card checkout. Upgrade = contact team / mailto.

---

## 10. Operations change log

| Date | Change |
|------|--------|
| 2026-07-20 | Required pre-deploy backup script; tracked migrations through v27; login count guard; Phase 3.1 UAT pack |
| Prior | Tenant SQL isolation; platform owner emails; retention UX; client `retention_exempt` |
