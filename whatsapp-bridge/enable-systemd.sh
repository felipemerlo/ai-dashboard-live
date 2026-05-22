#!/bin/bash
set -euo pipefail
SERVICE_SRC="/home/felip/.openclaw/workspace/whatsapp-bridge/systemd/whatsapp-bridge.service"
SERVICE_DST="/etc/systemd/system/whatsapp-bridge.service"
if [ ! -f "$SERVICE_SRC" ]; then
  echo "Service file not found at $SERVICE_SRC" >&2
  exit 2
fi
sudo cp "$SERVICE_SRC" "$SERVICE_DST"
sudo systemctl daemon-reload
sudo systemctl enable --now whatsapp-bridge.service
sudo systemctl status --no-pager whatsapp-bridge.service

