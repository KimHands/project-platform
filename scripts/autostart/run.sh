#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/../.." || exit 1
# Tailscale 주소에만 바인딩. 실패 시 exit → launchd KeepAlive가 10초 뒤 재시도.
host="$(bash scripts/autostart/tailscale-ip.sh)"
exec npm run start -- -H "$host" -p 4319
