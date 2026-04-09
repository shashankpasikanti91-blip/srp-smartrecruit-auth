#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# deploy.sh — First-time setup + deploy SRP AI Labs SmartRecruit on Hetzner
# Run on the Hetzner server as the deploy user:
#   bash deploy.sh
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="/opt/srp-smartrecruit-auth"
REPO_URL="https://github.com/SRP-AI-Labs/srp-smartrecruit-auth.git"
DOMAIN="app.srpailabs.com"
NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}"

echo "=== SRP AI Labs SmartRecruit — Hetzner Deploy ==="

# ── 1. Dependencies ───────────────────────────────────────────────────────────
echo "→ Installing system packages…"
sudo apt-get update -q
sudo apt-get install -y -q docker.io docker-compose-plugin nginx certbot python3-certbot-nginx git curl

sudo systemctl enable --now docker

# ── 2. Clone or update repo ───────────────────────────────────────────────────
if [ -d "${APP_DIR}/.git" ]; then
    echo "→ Updating existing repo…"
    cd "${APP_DIR}"
    git pull origin main
else
    echo "→ Cloning repo…"
    sudo mkdir -p "${APP_DIR}"
    sudo chown "$(whoami)":"$(whoami)" "${APP_DIR}"
    git clone "${REPO_URL}" "${APP_DIR}"
    cd "${APP_DIR}"
fi

# ── 3. Environment file ───────────────────────────────────────────────────────
if [ ! -f "${APP_DIR}/.env" ]; then
    echo ""
    echo "⚠️  No .env file found!"
    echo "   Copy .env.production to .env and fill in all values:"
    echo "   cp ${APP_DIR}/.env.production ${APP_DIR}/.env"
    echo "   nano ${APP_DIR}/.env"
    echo ""
    echo "   Required values to change:"
    echo "   - NEXTAUTH_SECRET  (run: openssl rand -base64 32)"
    echo "   - SMTP_PASS        (Google App Password)"
    echo "   - SUPABASE_SERVICE_ROLE_KEY"
    read -rp "Press Enter once .env is ready, or Ctrl+C to abort…"
fi

# ── 4. Build & Start Docker ───────────────────────────────────────────────────
echo "→ Building and starting container…"
cd "${APP_DIR}"
docker compose build --no-cache
docker compose up -d

# ── 5. Nginx ──────────────────────────────────────────────────────────────────
echo "→ Installing nginx config…"
sudo cp nginx.conf "${NGINX_CONF}"
sudo ln -sf "${NGINX_CONF}" /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# ── 6. SSL with Let's Encrypt ─────────────────────────────────────────────────
echo "→ Obtaining SSL certificate…"
sudo certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m pasikantishashank24@gmail.com

# ── 7. Verify ─────────────────────────────────────────────────────────────────
echo "→ Waiting for app to start…"
sleep 10
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3010/api/health")
if [ "${HTTP_CODE}" = "200" ]; then
    echo "✅ App is healthy (HTTP 200)"
else
    echo "⚠️  Health check returned HTTP ${HTTP_CODE} — check logs:"
    echo "   docker compose logs -f"
fi

echo ""
echo "✅ Deployment done!"
echo "   Local:  http://localhost:3010"
echo "   Live:   https://${DOMAIN}"
echo ""
echo "   Next steps:"
echo "   1. Add DNS A record: ${DOMAIN} → 5.223.67.236"
echo "   2. Apply DB schema in Supabase Dashboard → SQL Editor:"
echo "      • db/schema.sql (first run on fresh project)"
echo "      • db/migrate_v2.sql (adds IDs, pipeline, candidates table)"
echo "   3. Set SMTP_PASS  in .env  (Google App Password)"
echo "   4. Set repo secrets in GitHub for CI/CD:"
echo "      HETZNER_HOST, HETZNER_USER, HETZNER_SSH_KEY, PRODUCTION_ENV, NEXT_PUBLIC_SUPABASE_URL"
