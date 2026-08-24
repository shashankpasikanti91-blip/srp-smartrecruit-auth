# Apply migrate_v37_audit_ai.sql to local pgvector (docker-compose.pgvector.yml).
# Does not touch production.
$ErrorActionPreference = "Stop"
$container = if ($env:DB_CONTAINER) { $env:DB_CONTAINER } else { "srp-auth-pgvector" }
$dbUser = if ($env:DB_USER) { $env:DB_USER } else { "srp_ats" }
$dbName = if ($env:DB_NAME) { $env:DB_NAME } else { "srp_auth" }
$sql = Join-Path $PSScriptRoot "..\db\migrate_v37_audit_ai.sql"

if (-not (Test-Path $sql)) { throw "Missing $sql" }
Get-Content -Raw $sql | docker exec -i $container psql -U $dbUser -d $dbName -v ON_ERROR_STOP=1
Write-Host "v37 applied on $container / $dbName"
docker exec $container psql -U $dbUser -d $dbName -Atc "SELECT column_name FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name IN ('correlation_id','actor_type') ORDER BY 1;"
