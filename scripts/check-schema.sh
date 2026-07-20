#!/bin/bash
set -euo pipefail
docker cp /tmp/provision-niaga-prestasi.sql srp-auth-db:/tmp/provision-niaga-prestasi.sql
docker exec srp-auth-db psql -U srp_auth -d srp_auth -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'subscriptions' ORDER BY 1;"
docker exec srp-auth-db psql -U srp_auth -d srp_auth -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'tenants' AND column_name IN ('retention_exempt','max_users');"
docker exec srp-auth-db psql -U srp_auth -d srp_auth -c "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'subscriptions';"
