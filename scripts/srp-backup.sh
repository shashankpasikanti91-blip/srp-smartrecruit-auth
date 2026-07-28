#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# SRP SmartRecruit — Pre-deploy / daily backup (Next.js deploy path)
#
# Installed by CI as /usr/local/bin/srp-backup from this file.
# Backs up Auth DB (required), ATS DB (best-effort), and uploads.
#
# LOCAL:  /opt/backups/srp-smartrecruit/ — 30-day retention
# ONLINE: Supabase Storage bucket "srp-backups" when credentials present
#
# Never deletes tenant data, never truncates DBs, never wipes uploads.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

BACKUP_ROOT="/opt/backups/srp-smartrecruit"
KEEP_DAYS=30
DATE=$(date -u '+%Y-%m-%d_%H%M%S')
BACKUP_DIR="${BACKUP_ROOT}/${DATE}"
LOG_PREFIX="[SRP-BACKUP ${DATE}]"

ATS_DB_CONTAINER="srp-ats-db"
ATS_DB_NAME="srp_ats"
ATS_DB_USER="srp_ats"
ATS_UPLOADS_VOLUME="ats_uploads"

AUTH_DB_CONTAINER="srp-auth-db"
AUTH_DB_NAME="srp_auth"
AUTH_DB_USER="srp_auth"

AUTH_APP_DIR="/opt/srp-smartrecruit-auth"
AUTH_UPLOADS_HOST="${AUTH_APP_DIR}/uploads"

ENV_FILE="${AUTH_APP_DIR}/.env"
SUPABASE_URL=""
SUPABASE_KEY=""
SMTP_HOST=""; SMTP_PORT="587"; SMTP_USER=""; SMTP_PASS=""; OWNER_EMAIL=""

if [[ -f "$ENV_FILE" ]]; then
    while IFS='=' read -r key value; do
        [[ "$key" =~ ^# ]] && continue
        value="${value%%#*}"
        value="${value//\"/}"
        value="${value// /}"
        case "$key" in
            NEXT_PUBLIC_SUPABASE_URL)  SUPABASE_URL="$value" ;;
            SUPABASE_SERVICE_ROLE_KEY) SUPABASE_KEY="$value" ;;
            SMTP_HOST)                 SMTP_HOST="$value" ;;
            SMTP_PORT)                 SMTP_PORT="$value" ;;
            SMTP_USER)                 SMTP_USER="$value" ;;
            SMTP_PASS)                 SMTP_PASS="$value" ;;
            OWNER_EMAIL|OWNER_EMAILS)  OWNER_EMAIL="$value" ;;
        esac
    done < <(grep -v '^$' "$ENV_FILE" || true)
fi

SUPABASE_BUCKET="srp-backups"
CLOUD_UPLOAD_OK=0
EMAIL_SENT=0
ATS_OK=0
AUTH_UPLOADS_OK=0

echo "========================================================"
echo "${LOG_PREFIX} Starting backup"
echo "  Local:  ${BACKUP_DIR}"
echo "  Online: supabase://${SUPABASE_BUCKET}/${DATE}/"
echo "========================================================"

mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"

fail() { echo "${LOG_PREFIX} ERROR: $*" >&2; exit 1; }
ok()   { echo "${LOG_PREFIX} OK: $*"; }
warn() { echo "${LOG_PREFIX} WARN: $*"; }

container_running() {
    docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null | grep -qx true
}

# ── 1. ATS PostgreSQL (best-effort — frontend-only hosts may omit ATS) ───────
echo ""
echo "${LOG_PREFIX} [1/7] Dumping ATS database (${ATS_DB_NAME})..."
if container_running "${ATS_DB_CONTAINER}"; then
    docker exec "${ATS_DB_CONTAINER}" \
        pg_dump -U "${ATS_DB_USER}" -d "${ATS_DB_NAME}" \
        --format=custom --compress=9 \
        > "${BACKUP_DIR}/ats_database.dump" \
      && { ATS_OK=1; ok "ATS database dump: $(du -sh "${BACKUP_DIR}/ats_database.dump" | cut -f1)"; } \
      || warn "ATS pg_dump failed — continuing (Auth backup still required)"
else
    warn "ATS container ${ATS_DB_CONTAINER} not running — skipping ATS dump"
fi

# ── 2. Auth PostgreSQL (REQUIRED) ────────────────────────────────────────────
echo ""
echo "${LOG_PREFIX} [2/7] Dumping Auth database (${AUTH_DB_NAME})..."
container_running "${AUTH_DB_CONTAINER}" || fail "Auth container ${AUTH_DB_CONTAINER} not running"
docker exec "${AUTH_DB_CONTAINER}" \
    pg_dump -U "${AUTH_DB_USER}" -d "${AUTH_DB_NAME}" \
    --format=custom --compress=9 \
    > "${BACKUP_DIR}/auth_database.dump" \
  || fail "Auth pg_dump failed"
ok "Auth database dump: $(du -sh "${BACKUP_DIR}/auth_database.dump" | cut -f1)"

# ── 3. ATS resume uploads volume (best-effort) ───────────────────────────────
echo ""
echo "${LOG_PREFIX} [3/7] Backing up ATS uploads volume..."
if docker volume inspect "${ATS_UPLOADS_VOLUME}" >/dev/null 2>&1; then
    docker run --rm \
        -v "${ATS_UPLOADS_VOLUME}:/source:ro" \
        -v "${BACKUP_DIR}:/backup" \
        alpine:3.20 \
        sh -c "cd /source && tar -czf /backup/uploads.tar.gz . 2>/dev/null || true" \
      && ok "ATS uploads backup: $(du -sh "${BACKUP_DIR}/uploads.tar.gz" 2>/dev/null | cut -f1 || echo 'empty')" \
      || warn "ATS uploads backup had warnings"
else
    warn "Volume ${ATS_UPLOADS_VOLUME} not found — skipping"
fi

# ── 4. Next.js auth app uploads (resumes + candidate documents) ──────────────
echo ""
echo "${LOG_PREFIX} [4/7] Backing up Next.js uploads at ${AUTH_UPLOADS_HOST}..."
if [[ -d "${AUTH_UPLOADS_HOST}" ]]; then
    tar -czf "${BACKUP_DIR}/auth_uploads.tar.gz" -C "${AUTH_APP_DIR}" uploads \
      && { AUTH_UPLOADS_OK=1; ok "Auth uploads: $(du -sh "${BACKUP_DIR}/auth_uploads.tar.gz" | cut -f1)"; } \
      || warn "Auth uploads tar failed"
else
    warn "No ${AUTH_UPLOADS_HOST} directory — skipping (may be empty/new host)"
fi

# ── 5. Manifest ──────────────────────────────────────────────────────────────
echo ""
echo "${LOG_PREFIX} [5/7] Writing manifest..."
MANIFEST="${BACKUP_DIR}/manifest.json"
cat > "${MANIFEST}" << MANIFEST_EOF
{
  "created_at_utc": "${DATE}",
  "domain": "recruit.srpailabs.com",
  "source": "nextjs-auth/scripts/srp-backup.sh",
  "databases": {
    "ats": {
      "container": "${ATS_DB_CONTAINER}",
      "db": "${ATS_DB_NAME}",
      "file": "ats_database.dump",
      "ok": ${ATS_OK}
    },
    "auth": {
      "container": "${AUTH_DB_CONTAINER}",
      "db": "${AUTH_DB_NAME}",
      "file": "auth_database.dump",
      "ok": true
    }
  },
  "uploads_file": "uploads.tar.gz",
  "auth_uploads_file": "auth_uploads.tar.gz",
  "auth_uploads_ok": ${AUTH_UPLOADS_OK},
  "restore_docs": "docs/master/05-platform/Backup-DR.md"
}
MANIFEST_EOF
ok "Manifest written: ${MANIFEST}"

# ── 6. Prune local backups older than KEEP_DAYS ──────────────────────────────
echo ""
echo "${LOG_PREFIX} [6/7] Pruning local backups older than ${KEEP_DAYS} days..."
find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d \
    -mtime "+${KEEP_DAYS}" \
    ! -name "${DATE}" \
    -exec rm -rf {} + \
  && ok "Old local backups pruned (kept last ${KEEP_DAYS} days)" \
  || true

# ── 7. Optional Supabase offsite upload (NEVER fails local backup) ───────────
# Local Auth dump is the deploy gate. Cloud/email are best-effort only.
echo ""
echo "${LOG_PREFIX} [7/7] Uploading to Supabase Storage (offsite)..."

supabase_upload() {
    local file_path="$1"
    local remote_name="$2"
    local remote_key="${DATE}/${remote_name}"

    if [[ -z "$SUPABASE_URL" || -z "$SUPABASE_KEY" ]]; then
        warn "Supabase credentials not found — skipping cloud upload of ${remote_name}"
        return 1
    fi
    if [[ ! -f "$file_path" ]]; then
        warn "File not found, skipping upload: ${file_path}"
        return 1
    fi

    echo "  Uploading ${remote_name} ($(du -sh "${file_path}" | cut -f1))..."
    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST \
        "${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${remote_key}" \
        -H "Authorization: Bearer ${SUPABASE_KEY}" \
        -H "Content-Type: application/octet-stream" \
        -H "x-upsert: true" \
        --data-binary @"${file_path}" \
        --max-time 300) || http_code="000"

    if [[ "$http_code" =~ ^2 ]]; then
        ok "  Cloud upload OK — ${remote_key}"
        return 0
    else
        warn "  Cloud upload failed: HTTP ${http_code} for ${remote_name}"
        return 1
    fi
}

cloud_upload_section() {
    if [[ -z "$SUPABASE_URL" || -z "$SUPABASE_KEY" ]]; then
        warn "Supabase not configured — only local backup was created"
        return 0
    fi

    local BUCKET_CODE
    BUCKET_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST \
        "${SUPABASE_URL}/storage/v1/bucket" \
        -H "Authorization: Bearer ${SUPABASE_KEY}" \
        -H "Content-Type: application/json" \
        -d "{\"id\":\"${SUPABASE_BUCKET}\",\"name\":\"${SUPABASE_BUCKET}\",\"public\":false}" \
        --max-time 30) || BUCKET_CODE="000"

    if [[ "$BUCKET_CODE" == "200" || "$BUCKET_CODE" == "409" ]]; then
        ok "Supabase bucket '${SUPABASE_BUCKET}' ready"
    else
        warn "Could not ensure bucket exists (HTTP ${BUCKET_CODE}) — will still attempt upload"
    fi

    local UPLOAD_ERRORS=0
    if [[ -f "${BACKUP_DIR}/ats_database.dump" ]]; then
        supabase_upload "${BACKUP_DIR}/ats_database.dump" "ats_database.dump" || true
    fi
    if ! supabase_upload "${BACKUP_DIR}/auth_database.dump" "auth_database.dump"; then
        UPLOAD_ERRORS=$((UPLOAD_ERRORS + 1))
    fi
    if [[ -f "${BACKUP_DIR}/uploads.tar.gz" ]]; then
        supabase_upload "${BACKUP_DIR}/uploads.tar.gz" "uploads.tar.gz" || true
    fi
    if [[ -f "${BACKUP_DIR}/auth_uploads.tar.gz" ]]; then
        supabase_upload "${BACKUP_DIR}/auth_uploads.tar.gz" "auth_uploads.tar.gz" || true
    fi
    supabase_upload "${BACKUP_DIR}/manifest.json" "manifest.json" || true

    if [[ $UPLOAD_ERRORS -eq 0 ]]; then
        CLOUD_UPLOAD_OK=1
        ok "Required auth dump uploaded to Supabase Storage"
    else
        warn "Auth dump cloud upload failed — local backup still intact"
    fi
}

cloud_upload_section || warn "Cloud upload section errored — local backup still intact"

# ── Email notification (best-effort) ─────────────────────────────────────────
email_notify_section() {
    [[ -n "$SMTP_HOST" && -n "$SMTP_USER" && -n "$SMTP_PASS" && -n "$OWNER_EMAIL" ]] || return 0
    echo ""
    local TOTAL_SIZE
    TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" | cut -f1)
    local CLOUD_STATUS="Uploaded to Supabase Storage"
    [[ $CLOUD_UPLOAD_OK -eq 0 ]] && CLOUD_STATUS="Cloud upload skipped/failed — local only"

    local SUBJECT="SRP SmartRecruit Backup — ${DATE}"
    local BODY="SRP SmartRecruit Backup Report

Date:         ${DATE} UTC
Local path:   ${BACKUP_DIR}
Total size:   ${TOTAL_SIZE}
Cloud:        ${CLOUD_STATUS}

Files:
  - auth_database.dump (REQUIRED)
  - ats_database.dump (if ATS present)
  - uploads.tar.gz / auth_uploads.tar.gz

Retention: ${KEEP_DAYS} days local. No tenant data deleted."

    if curl -s \
        --url "smtp://${SMTP_HOST}:${SMTP_PORT}" \
        --ssl-reqd \
        --mail-from "${SMTP_USER}" \
        --mail-rcpt "${OWNER_EMAIL}" \
        --user "${SMTP_USER}:${SMTP_PASS}" \
        -T <(printf "From: SRP Backup <%s>\r\nTo: %s\r\nSubject: %s\r\n\r\n%s\r\n" \
            "${SMTP_USER}" "${OWNER_EMAIL}" "${SUBJECT}" "${BODY}") \
        2>/dev/null; then
        EMAIL_SENT=1
        ok "Email notification sent to ${OWNER_EMAIL}"
    else
        warn "Email notification failed (backup is still fine)"
    fi
}

email_notify_section || warn "Email notify section errored — local backup still intact"

# Require local Auth dump — this is the deploy rollback point
[[ -f "${BACKUP_DIR}/auth_database.dump" ]] || fail "Auth database dump missing after backup"
[[ -s "${BACKUP_DIR}/auth_database.dump" ]] || fail "Auth database dump is empty"

echo ""
TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" | cut -f1)
BACKUP_COUNT=$(find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d | wc -l)
CLOUD_MSG="NOT uploaded (no credentials or failure)"
[[ $CLOUD_UPLOAD_OK -eq 1 ]] && CLOUD_MSG="Uploaded to Supabase Storage"
EMAIL_MSG="not sent"
[[ $EMAIL_SENT -eq 1 ]] && EMAIL_MSG="sent to ${OWNER_EMAIL}"
echo "========================================================"
echo "${LOG_PREFIX} Backup COMPLETE"
echo "  Local path:   ${BACKUP_DIR}"
echo "  Size:         ${TOTAL_SIZE}"
echo "  Local copies: ${BACKUP_COUNT} (${KEEP_DAYS}-day retention)"
echo "  Cloud:        ${CLOUD_MSG}"
echo "  Email:        ${EMAIL_MSG}"
echo "  Rollback:     ${BACKUP_DIR}/auth_database.dump"
echo "========================================================"
