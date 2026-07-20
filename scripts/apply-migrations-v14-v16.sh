#!/usr/bin/env bash
# Apply SRP migration SQL (v14-v16) idempotently. Safe to re-run.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_URL="${DATABASE_URL:-}"

if [[ -z "$DB_URL" ]]; then
  echo "Set DATABASE_URL (postgres connection string) and re-run."
  exit 1
fi

for f in migrate_v14_candidate_documents.sql migrate_v15_workflow.sql migrate_v16_ess_lite.sql; do
  echo "==> $f"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$ROOT/db/$f"
done

echo "Migrations v14–v16 applied."
