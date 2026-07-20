#!/bin/bash
echo "=== HOST /opt/srp-smartrecruit-auth/.env keys ==="
grep -E '^(OPENAI_|DATABASE_URL|NEXTAUTH_|POSTGRES_)' /opt/srp-smartrecruit-auth/.env | sed 's/=.*/=***/' || echo 'host env missing'
echo "=== CONTAINER /app/.env keys ==="
docker exec srp-auth-app sh -c 'grep -E "^(OPENAI_|DATABASE_URL|NEXTAUTH_|POSTGRES_)" /app/.env | sed "s/=.*/=***/"' || true
echo "=== HOST has OPENAI? ==="
grep -c '^OPENAI_API_KEY=' /opt/srp-smartrecruit-auth/.env || echo 0
echo "=== compose env_file ==="
grep -A5 'env_file\|environment\|OPENAI' /opt/srp-smartrecruit-auth/docker-compose.yml | head -40
