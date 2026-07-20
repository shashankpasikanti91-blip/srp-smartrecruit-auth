#!/bin/bash
set -e
df -h / | tail -1
# Remove dangling / unused images only (containers untouched)
docker image prune -af || true
docker builder prune -af || true
rm -rf /tmp/srp-deploy
mkdir -p /tmp/srp-deploy
df -h / | tail -1
