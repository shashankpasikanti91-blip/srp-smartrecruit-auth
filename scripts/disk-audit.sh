#!/bin/bash
df -h /
echo '---'
du -xhd1 /var/lib/docker 2>/dev/null | sort -hr | head -8
echo '---'
du -sh /opt/backups /var/log /tmp /root 2>/dev/null
echo '---'
docker ps -a --filter status=exited --format '{{.Names}} {{.Size}}' | head -20
ls -lah /opt/backups 2>/dev/null | head -15
