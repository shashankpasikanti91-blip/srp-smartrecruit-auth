#!/usr/bin/env bash
# SmartRecruit keep-alive — run from cron every 5 minutes.
# NEVER: systemctl restart docker, docker restart (daemon), nginx stop,
#        or touch Wellora / SRP website / SmartRecruit volumes.
set -u

# Keep forever: SmartRecruit, Wellora, SRP website, n8n
PROTECTED_RE='wellora|smartrecruit|srp-auth|srp-web|srp_web|srp-site|srp-ats|srpailabs|n8n|portainer|nginx|caddy|traefik'
# Only these leftovers may be removed (never n8n / Wellora / SRP site / SmartRecruit)
UNPROTECTED_RE='^(mediflow|mediflow-db|srp-mediflow|cadvisor|dozzle)(-|$)'

ENVF="${SRP_ENV_FILE:-/opt/srp-smartrecruit-auth/.env}"
LOG="${SRP_KEEPALIVE_LOG:-/var/log/srp-keep-alive.log}"
mkdir -p "$(dirname "$LOG")" 2>/dev/null || true

telegram() {
  local msg="$1"
  [ -f "$ENVF" ] || return 0
  local token chat
  token=$(grep -E '^TELEGRAM_BOT_TOKEN=' "$ENVF" | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\r')
  chat=$(grep -E '^TELEGRAM_CHAT_ID=' "$ENVF" | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\r')
  [ -n "$token" ] && [ -n "$chat" ] || return 0
  curl -sS -X POST "https://api.telegram.org/bot${token}/sendMessage" \
    --data-urlencode "chat_id=${chat}" \
    --data-urlencode "text=${msg}" >/dev/null 2>&1 || true
}

is_protected() {
  echo "$1" | tr '[:upper:]' '[:lower:]' | grep -Eq "$PROTECTED_RE"
}

safe_prune() {
  sudo find /var/lib/docker/containers -name '*-json.log' -size +20M -exec truncate -s 0 {} \; 2>/dev/null || true
  docker image prune -f >/dev/null 2>&1 || true
  docker builder prune -af >/dev/null 2>&1 || true
  if [ -d /opt/backups/srp-smartrecruit ]; then
    sudo find /opt/backups/srp-smartrecruit -mindepth 1 -maxdepth 1 -type d -mtime +7 -exec rm -rf {} + 2>/dev/null || true
  fi
  sudo journalctl --vacuum-size=80M >/dev/null 2>&1 || true
}

ensure_smartrecruit() {
  docker start srp-auth-db >/dev/null 2>&1 || true
  local i
  for i in $(seq 1 20); do
    if docker exec srp-auth-db pg_isready -U srp_auth -d srp_auth >/dev/null 2>&1; then
      break
    fi
    sleep 3
  done
  docker start srp-auth-app >/dev/null 2>&1 || true
}

http_code() {
  curl -s -o /dev/null -w "%{http_code}" --max-time 8 "$1" 2>/dev/null || echo "000"
}

DISK_PCT=$(df -P / | awk 'NR==2 {gsub("%","",$5); print $5}')
HEALTH=$(http_code "http://127.0.0.1:3010/api/health")
# curl -w still prints 000 on failure; extra "000" must not concatenate
HEALTH="${HEALTH: -3}"

if [ "${DISK_PCT:-0}" -ge 80 ] 2>/dev/null; then
  echo "$(date -u +%FT%TZ) disk=${DISK_PCT}% — safe prune" >>"$LOG"
  safe_prune
  telegram "SmartRecruit disk ${DISK_PCT}%. Cleaned logs/cache/old backups only. Protected: SmartRecruit + Wellora + SRP website + n8n. https://recruit.srpailabs.com"
fi

if [ "$HEALTH" != "200" ]; then
  echo "$(date -u +%FT%TZ) health=${HEALTH} — restart srp-auth only" >>"$LOG"
  safe_prune
  ensure_smartrecruit
  sleep 8
  HEALTH2=$(http_code "http://127.0.0.1:3010/api/health")
  HEALTH2="${HEALTH2: -3}"
  if [ "$HEALTH2" = "200" ]; then
    telegram "AI Screening was down (HTTP ${HEALTH}). Watchdog restarted SmartRecruit only. Wellora, SRP website, and n8n were not touched. Live again: https://recruit.srpailabs.com"
  else
    telegram "CRITICAL: SmartRecruit still down after watchdog (HTTP ${HEALTH} then ${HEALTH2}). Wellora / SRP website / n8n not touched. Check disk. https://recruit.srpailabs.com"
  fi
fi

# Optional one-shot: SRP_REMOVE_UNPROTECTED=1
if [ "${SRP_REMOVE_UNPROTECTED:-0}" = "1" ]; then
  echo "$(date -u +%FT%TZ) removing explicit leftover containers (not the three products)" >>"$LOG"
  docker ps -a --format '{{.Names}}' | while read -r name; do
    [ -z "$name" ] && continue
    if is_protected "$name"; then
      echo "KEEP protected $name"
      continue
    fi
    if echo "$name" | tr '[:upper:]' '[:lower:]' | grep -Eq "$UNPROTECTED_RE"; then
      echo "REMOVE leftover $name"
      docker stop "$name" >/dev/null 2>&1 || true
      docker rm "$name" >/dev/null 2>&1 || true
    else
      echo "SKIP unknown $name (not in leftover allowlist)"
    fi
  done
  docker image prune -f >/dev/null 2>&1 || true
fi

exit 0
