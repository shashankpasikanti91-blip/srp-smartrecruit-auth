#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# apply-tracked-migrations.sh
# Applies ONLY the additive migrations registered in scripts/run-migrations.mjs.
# Safe for existing tenants: IF NOT EXISTS / ON CONFLICT / additive indexes.
# Does NOT drop tables, truncate data, or reset auth_users / sessions.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/srp-smartrecruit-auth}"
DB_CONTAINER="${DB_CONTAINER:-srp-auth-db}"
DB_USER="${DB_USER:-srp_auth}"
DB_NAME="${DB_NAME:-srp_auth}"

FILES=(
  migrate_v0_schema_migrations.sql
  migrate_v14_candidate_documents.sql
  migrate_v15_workflow.sql
  migrate_v16_ess_lite.sql
  migrate_v17_submission_history.sql
  migrate_v18_offer_history.sql
  migrate_v19_ess_full.sql
  migrate_v20_governance.sql
  migrate_v21_ess_approval_audit.sql
  migrate_v22_recruitment_os.sql
  migrate_v23_phase2_os.sql
  migrate_v24_job_candidate_parse.sql
  migrate_v25_phase25_production.sql
  migrate_v26_phase3_intelligence.sql
  migrate_v27_perf_indexes.sql
  migrate_v28_entity_notes.sql
  migrate_v29_lifecycle.sql
  migrate_v30_bulk_queue.sql
  migrate_v31_enterprise.sql
  migrate_v32_platform.sql
)

echo "=== Applying tracked migrations (additive only) ==="
BEFORE=$(docker exec "${DB_CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" -Atc \
  "SELECT COUNT(*) FROM auth_users" 2>/dev/null || echo "0")
echo "auth_users before: ${BEFORE}"

for f in "${FILES[@]}"; do
  path="${APP_DIR}/db/${f}"
  if [ ! -f "${path}" ]; then
    echo "SKIP missing: ${f}"
    continue
  fi
  echo "==> ${f}"
  docker exec -i "${DB_CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" -v ON_ERROR_STOP=1 < "${path}"
done

AFTER=$(docker exec "${DB_CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" -Atc \
  "SELECT COUNT(*) FROM auth_users")
echo "auth_users after:  ${AFTER}"

if [ "${BEFORE}" != "${AFTER}" ]; then
  echo "ERROR: auth_users count changed (${BEFORE} → ${AFTER}). Abort — investigate before continuing deploy."
  exit 1
fi

echo "✅ Migrations applied. Login users unchanged (${AFTER})."
