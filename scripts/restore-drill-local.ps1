# Local restore drill against srp-auth-pgvector.
# Dumps srp_auth, restores into a throwaway DB, verifies v37 columns, then drops the drill DB.
# Never restores over the live local database.
$ErrorActionPreference = "Stop"
$container = if ($env:DB_CONTAINER) { $env:DB_CONTAINER } else { "srp-auth-pgvector" }
$dbUser = if ($env:DB_USER) { $env:DB_USER } else { "srp_ats" }
$liveDb = if ($env:DB_NAME) { $env:DB_NAME } else { "srp_auth" }
$drillDb = "srp_auth_restore_drill"
$dump = "/tmp/srp_auth_restore_drill.dump"

Write-Host "=== Restore drill (local, throwaway DB) ==="
$before = docker exec $container psql -U $dbUser -d $liveDb -Atc "SELECT COUNT(*) FROM auth_users"
Write-Host "auth_users on live: $before"

docker exec $container pg_dump -U $dbUser -d $liveDb -Fc -f $dump
docker exec $container psql -U $dbUser -d postgres -c "DROP DATABASE IF EXISTS $drillDb;"
docker exec $container psql -U $dbUser -d postgres -c "CREATE DATABASE $drillDb OWNER $dbUser;"
docker exec $container pg_restore -U $dbUser -d $drillDb --no-owner --no-acl $dump

$cols = docker exec $container psql -U $dbUser -d $drillDb -Atc "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name IN ('correlation_id','actor_type')"
if ($cols -lt 2) { throw "Drill DB missing v37 audit columns (got $cols)" }

$users = docker exec $container psql -U $dbUser -d $drillDb -Atc "SELECT COUNT(*) FROM auth_users"
if ($users -ne $before) { throw "User count mismatch live=$before drill=$users" }

docker exec $container psql -U $dbUser -d postgres -c "DROP DATABASE $drillDb;"
docker exec $container rm -f $dump

$after = docker exec $container psql -U $dbUser -d $liveDb -Atc "SELECT COUNT(*) FROM auth_users"
if ($after -ne $before) { throw "Live auth_users changed during drill ($before -> $after)" }

Write-Host "PASS restore drill: dump -> $drillDb -> verified v37 + user count $users -> dropped. Live $liveDb unchanged."
Write-Host "Record: date=$(Get-Date -Format u) operator=$env:USERNAME rpo=local-dump rto=this-script"
