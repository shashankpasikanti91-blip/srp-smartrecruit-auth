#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# srp-backup.sh — Pre-deploy / nightly backup for SmartRecruit
#
# Guarantees:
#   - Never drops or truncates data
#   - Never touches auth session cookies
#   - Backs up Postgres (all tenants) + uploads volume
#
# Install on server:
#   sudo cp scripts/srp-backup.sh /usr/local/bin/srp-backup
#   sudo chmod +x /usr/local/bin/srp-backup
#
# Usage:
#   sudo /usr/local/bin/srp-backup
#   SRP_BACKUP_DIR=/var/backups/srp-smartrecruit sudo /usr/local/bin/srp-backup
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/srp-smartrecruit-auth}"
BACKUP_ROOT="${SRP_BACKUP_DIR:-/var/backups/srp-smartrecruit}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="${BACKUP_ROOT}/${STAMP}"
DB_CONTAINER="${DB_CONTAINER:-srp-auth-db}"
DB_USER="${DB_USER:-srp_auth}"
DB_NAME="${DB_NAME:-srp_auth}"
KEEP_DAYS="${SRP_BACKUP_KEEP_DAYS:-14}"

mkdir -p "${DEST}"
echo "=== SRP backup ${STAMP} → ${DEST} ==="

# 1) Postgres logical dump (all tenants, auth_users, sessions, memberships)
if ! docker ps --format '{{.Names}}' | grep -qx "${DB_CONTAINER}"; then
  echo "ERROR: DB container ${DB_CONTAINER} is not running — aborting backup"
  exit 1
fi

echo "→ pg_dump ${DB_NAME}"
docker exec "${DB_CONTAINER}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" --no-owner --format=custom \
  > "${DEST}/srp_auth.dump"
# Also a plain SQL for easy spot-checks (optional but useful)
docker exec "${DB_CONTAINER}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" --no-owner --format=plain \
  > "${DEST}/srp_auth.sql"
gzip -f "${DEST}/srp_auth.sql"

# 2) Tenant / login sanity snapshot (counts only — no PII dump beyond counts)
docker exec "${DB_CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" -Atc "
SELECT 'tenants=' || COUNT(*) FROM tenants;
SELECT 'members=' || COUNT(*) FROM tenant_members;
SELECT 'users=' || COUNT(*) FROM auth_users;
SELECT 'active_users=' || COUNT(*) FROM auth_users WHERE is_active IS TRUE;
SELECT 'jobs=' || COUNT(*) FROM job_posts;
SELECT 'candidates=' || COUNT(*) FROM resumes;
" > "${DEST}/row_counts.txt" || true

# 3) Uploads (resumes / documents) if present on host
if [ -d "${APP_DIR}/uploads" ]; then
  echo "→ archiving uploads/"
  tar -C "${APP_DIR}" -czf "${DEST}/uploads.tar.gz" uploads
else
  echo "→ no uploads/ directory — skipped"
fi

# 4) Env fingerprint (names only — never copy secret values into backup notes)
if [ -f "${APP_DIR}/.env" ]; then
  grep -E '^[A-Z0-9_]+=' "${APP_DIR}/.env" | cut -d= -f1 | sort > "${DEST}/env_keys.txt" || true
fi

# 5) Manifest
{
  echo "stamp=${STAMP}"
  echo "app_dir=${APP_DIR}"
  echo "db_container=${DB_CONTAINER}"
  echo "created_utc=$(date -u -Iseconds)"
  ls -lh "${DEST}"
} > "${DEST}/MANIFEST.txt"

# 6) Retention
find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d -mtime "+${KEEP_DAYS}" -exec rm -rf {} + 2>/dev/null || true

echo "✅ Backup complete: ${DEST}"
echo "   Restore example:"
echo "   gunzip -c ${DEST}/srp_auth.sql.gz | docker exec -i ${DB_CONTAINER} psql -U ${DB_USER} -d ${DB_NAME}"
echo "   # or: docker exec -i ${DB_CONTAINER} pg_restore -U ${DB_USER} -d ${DB_NAME} --clean --if-exists < ${DEST}/srp_auth.dump"
