#!/bin/bash
set -euo pipefail
SRC_DIR="/home/felip/.openclaw/workspace/whatsapp-bridge/.local_auth"
if [ ! -d "$SRC_DIR" ]; then
  SRC_DIR="/home/felip/.openclaw/workspace/whatsapp-bridge/.local-auth" || true
fi
OUT_DIR="/home/felip/.openclaw/workspace/whatsapp-bridge/backups"
mkdir -p "$OUT_DIR"
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
tar -czf "$OUT_DIR/session-backup-$TIMESTAMP.tar.gz" -C "/home/felip/.openclaw/workspace/whatsapp-bridge" LocalAuth || true
find "$OUT_DIR" -type f -mtime +30 -delete

