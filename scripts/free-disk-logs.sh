#!/bin/bash
# Truncate oversized Docker container JSON logs only.
# Does not stop containers, delete volumes, or touch /opt project trees.
set -e
echo "Before:"
df -h / | tail -1
find /var/lib/docker/containers -name '*-json.log' -size +20M -print -exec truncate -s 0 {} \;
echo "After:"
df -h / | tail -1
