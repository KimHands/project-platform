#!/bin/bash
set -euo pipefail

LABEL="com.kimjonggun.project-platform"
APP_DIR="$(cd "$(dirname "$0")/../.." && pwd -P)"

cd "$APP_DIR"
echo "==> 재빌드"
npm run build
echo "==> 서비스 재시작"
launchctl kickstart -k "gui/$UID/$LABEL"
echo "✅ 재빌드 후 재시작 완료."
