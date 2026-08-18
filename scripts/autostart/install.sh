#!/bin/bash
set -euo pipefail

LABEL="com.kimjonggun.project-platform"
PORT=4319
APP_DIR="$(cd "$(dirname "$0")/../.." && pwd -P)"
PLIST_DIR="$HOME/Library/LaunchAgents"
PLIST="$PLIST_DIR/$LABEL.plist"
LOG_DIR="$HOME/Library/Logs/project-platform"

if [ "$(uname)" != "Darwin" ]; then
  echo "이 스크립트는 macOS 전용입니다." >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "node/npm을 찾을 수 없습니다. Homebrew node를 설치하세요." >&2
  exit 1
fi
NODE_BIN="$(dirname "$(command -v node)")"

echo "==> 의존성 설치 및 빌드"
cd "$APP_DIR"
npm install
npm run build

echo "==> 로그 디렉터리 및 plist 생성"
mkdir -p "$LOG_DIR" "$PLIST_DIR"
node "$APP_DIR/scripts/autostart/render-plist.mjs" \
  "$LABEL" "$NODE_BIN" "$APP_DIR" "$PORT" "$LOG_DIR" > "$PLIST"

echo "==> launchctl 등록 (멱등)"
if launchctl print "gui/$UID/$LABEL" >/dev/null 2>&1; then
  launchctl bootout "gui/$UID" "$PLIST" || true
fi
launchctl bootstrap "gui/$UID" "$PLIST"

echo "==> 기동 확인 (최대 ~12초)"
if curl -sf --retry 5 --retry-delay 2 "http://localhost:$PORT" >/dev/null; then
  echo "✅ 자동실행 등록 완료. http://localhost:$PORT 에서 대시보드가 실행 중입니다."
  echo "   로그인할 때마다 자동으로 뜹니다."
else
  echo "⚠️  서비스는 등록됐지만 아직 응답이 없습니다. 로그를 확인하세요:" >&2
  echo "   $LOG_DIR/err.log" >&2
fi
