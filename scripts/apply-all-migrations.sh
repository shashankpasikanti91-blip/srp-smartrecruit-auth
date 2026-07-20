#!/usr/bin/env bash
# Apply all SRP migrations (v0 + v14–v21) idempotently via schema_migrations registry.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_URL="${DATABASE_URL:-}"

if [[ -z "$DB_URL" ]]; then
  echo "Set DATABASE_URL and re-run."
  exit 1
fi

MIGRATIONS=(
  migrate_v0_schema_migrations.sql
  migrate_v14_candidate_documents.sql
  migrate_v15_workflow.sql
  migrate_v16_ess_lite.sql
  migrate_v17_submission_history.sql
  migrate_v18_offer_history.sql
  migrate_v19_ess_full.sql
  migrate_v20_governance.sql
  migrate_v21_ess_approval_audit.sql
)

for f in "${MIGRATIONS[@]}"; do
  version="${f%.sql}"
  exists=$(psql "$DB_URL" -tAc "SELECT 1 FROM schema_migrations WHERE version='$version'" 2>/dev/null || echo "")
  if [[ "$exists" == "1" ]]; then
    echo "SKIP $version (already applied)"
    continue
  fi
  echo "==> $f"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$ROOT/db/$f"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -c "INSERT INTO schema_migrations (version) VALUES ('$version') ON CONFLICT DO NOTHING"
done

echo "All migrations applied."
