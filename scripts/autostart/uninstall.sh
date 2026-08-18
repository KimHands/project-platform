#!/bin/bash
set -euo pipefail

LABEL="com.kimjonggun.project-platform"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

if launchctl print "gui/$UID/$LABEL" >/dev/null 2>&1; then
  launchctl bootout "gui/$UID" "$PLIST" || true
fi
rm -f "$PLIST"
echo "✅ 자동실행 해제 완료. plist를 제거했습니다."
