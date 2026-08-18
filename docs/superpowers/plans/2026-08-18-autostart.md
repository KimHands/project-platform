# 부팅 자동실행 (C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로그인(부팅) 시 macOS LaunchAgent가 대시보드를 전용 포트 4319에서 자동 구동하고, 설치·해제·재빌드를 스크립트로 제공한다.

**Architecture:** 사용자 레벨 LaunchAgent 하나. plist 문자열은 순수 ESM 함수 `render-plist.mjs`가 생성(Vitest로 TDD)하고, `install.sh`/`uninstall.sh`/`rebuild.sh`가 build·launchctl 등록을 담당. launchd는 PATH/cwd가 없으므로 절대경로를 plist에 구워 넣는다.

**Tech Stack:** macOS launchd(launchctl), bash, Node ESM, Vitest.

## Global Constraints

- 대상 플랫폼: macOS 전용. node/npm은 `/opt/homebrew/bin`(설치 시 `dirname $(which node)`로 결정).
- 전용 포트 **4319**. 개발용 3000과 분리. 접속 `http://localhost:4319`.
- 구동 모드: 사전 build 후 `next start`. 브라우저 자동 열기 안 함.
- Label: `com.kimjonggun.project-platform`. plist 경로: `~/Library/LaunchAgents/com.kimjonggun.project-platform.plist`. 로그: `~/Library/Logs/project-platform/{out,err}.log`.
- **부팅 등록(launchctl bootstrap)은 사용자가 직접 `npm run autostart:install`로 실행.** 이 계획의 구현자는 스크립트 작성·plist 렌더 테스트까지만 하고, 실제 시스템 등록은 하지 않는다(안전 게이트).
- 셸 스크립트는 `set -euo pipefail`.
- TDD: `render-plist.mjs`는 실패 테스트 먼저.
- 커밋 메시지 말미에 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## Task 1: render-plist.mjs — plist 렌더러 (TDD)

**Files:**
- Create: `scripts/autostart/render-plist.mjs`
- Test: `scripts/autostart/render-plist.test.ts`

**Interfaces:**
- Produces: `export function renderPlist({ label, nodeBin, appDir, port, logDir }): string` — launchd plist XML 문자열 반환. `appDir`/`logDir`의 XML 특수문자(`& < > "`)를 이스케이프.

- [ ] **Step 1: vitest include 글로브 확인**

`vitest.config.ts`의 `include`는 현재 `['lib/**/*.test.ts']`이다. 이 태스크의 테스트는 `scripts/` 아래에 있으므로 include를 확장해야 한다. `vitest.config.ts`를 열어 `include`를 다음으로 변경:
```ts
include: ['lib/**/*.test.ts', 'scripts/**/*.test.ts'],
```
다른 설정은 그대로 둔다.

- [ ] **Step 2: 실패 테스트 작성**

`scripts/autostart/render-plist.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { renderPlist } from './render-plist.mjs'

const base = {
  label: 'com.kimjonggun.project-platform',
  nodeBin: '/opt/homebrew/bin',
  appDir: '/Users/kim/Desktop/Projects/project-platform',
  port: 4319,
  logDir: '/Users/kim/Library/Logs/project-platform',
}

describe('renderPlist', () => {
  it('Label과 run.sh ProgramArguments를 포함한다', () => {
    const xml = renderPlist(base)
    expect(xml).toContain('<string>com.kimjonggun.project-platform</string>')
    expect(xml).toContain('<string>/bin/bash</string>')
    expect(xml).toContain(`<string>${base.appDir}/scripts/autostart/run.sh</string>`)
  })

  it('PORT·PATH·WorkingDirectory·RunAtLoad·KeepAlive·ThrottleInterval을 담는다', () => {
    const xml = renderPlist(base)
    expect(xml).toContain('<key>PORT</key>')
    expect(xml).toContain('<string>4319</string>')
    expect(xml).toContain('/opt/homebrew/bin:/usr/bin:/bin')
    expect(xml).toContain(`<key>WorkingDirectory</key>`)
    expect(xml).toContain(`<string>${base.appDir}</string>`)
    expect(xml).toMatch(/<key>RunAtLoad<\/key>\s*<true\/>/)
    expect(xml).toMatch(/<key>KeepAlive<\/key>\s*<true\/>/)
    expect(xml).toMatch(/<key>ThrottleInterval<\/key>\s*<integer>10<\/integer>/)
  })

  it('로그 경로를 StandardOutPath/StandardErrorPath에 넣는다', () => {
    const xml = renderPlist(base)
    expect(xml).toContain(`<string>${base.logDir}/out.log</string>`)
    expect(xml).toContain(`<string>${base.logDir}/err.log</string>`)
  })

  it('appDir의 & 문자를 XML 이스케이프한다', () => {
    const xml = renderPlist({ ...base, appDir: '/Users/kim/a & b/proj' })
    expect(xml).toContain('/Users/kim/a &amp; b/proj')
    expect(xml).not.toContain('/Users/kim/a & b/proj')
  })

  it('유효한 plist 헤더로 시작한다', () => {
    const xml = renderPlist(base)
    expect(xml.startsWith('<?xml')).toBe(true)
    expect(xml).toContain('<!DOCTYPE plist')
  })
})
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npx vitest run scripts/autostart/render-plist.test.ts`
Expected: FAIL — `render-plist.mjs` 없음.

- [ ] **Step 4: render-plist.mjs 구현**

`scripts/autostart/render-plist.mjs`:
```js
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderPlist({ label, nodeBin, appDir, port, logDir }) {
  const runScript = `${appDir}/scripts/autostart/run.sh`
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${esc(label)}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${esc(runScript)}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${esc(appDir)}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>${esc(nodeBin)}:/usr/bin:/bin</string>
    <key>PORT</key>
    <string>${esc(port)}</string>
    <key>NODE_ENV</key>
    <string>production</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>StandardOutPath</key>
  <string>${esc(logDir)}/out.log</string>
  <key>StandardErrorPath</key>
  <string>${esc(logDir)}/err.log</string>
</dict>
</plist>
`
}

// CLI 사용: node render-plist.mjs <label> <nodeBin> <appDir> <port> <logDir>
import { fileURLToPath } from 'node:url'
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [, , label, nodeBin, appDir, port, logDir] = process.argv
  process.stdout.write(renderPlist({ label, nodeBin, appDir, port: Number(port), logDir }))
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run scripts/autostart/render-plist.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: 전체 테스트 회귀 확인**

Run: `npm test`
Expected: 기존 28 + 신규 5 = 33 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/autostart/render-plist.mjs scripts/autostart/render-plist.test.ts vitest.config.ts
git commit -m "feat(autostart): plist 렌더러와 테스트

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: 셸 스크립트 3종 + run.sh + package.json

**Files:**
- Create: `scripts/autostart/run.sh`, `scripts/autostart/install.sh`, `scripts/autostart/uninstall.sh`, `scripts/autostart/rebuild.sh`
- Modify: `package.json` (scripts 추가)

**Interfaces:**
- Consumes: `render-plist.mjs` (Task 1) via `node scripts/autostart/render-plist.mjs ...`.
- Produces: `npm run autostart:install` / `autostart:uninstall` / `autostart:rebuild` 명령. 설치 시 `~/Library/LaunchAgents/com.kimjonggun.project-platform.plist` 생성·로드.

- [ ] **Step 1: run.sh 작성**

`scripts/autostart/run.sh`:
```bash
#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/../.." || exit 1
exec npm run start -- -p 4319
```

- [ ] **Step 2: install.sh 작성**

`scripts/autostart/install.sh`:
```bash
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
```

- [ ] **Step 3: uninstall.sh 작성**

`scripts/autostart/uninstall.sh`:
```bash
#!/bin/bash
set -euo pipefail

LABEL="com.kimjonggun.project-platform"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

if launchctl print "gui/$UID/$LABEL" >/dev/null 2>&1; then
  launchctl bootout "gui/$UID" "$PLIST" || true
fi
rm -f "$PLIST"
echo "✅ 자동실행 해제 완료. plist를 제거했습니다."
```

- [ ] **Step 4: rebuild.sh 작성**

`scripts/autostart/rebuild.sh`:
```bash
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
```

- [ ] **Step 5: 실행 권한 부여**

Run:
```bash
chmod +x scripts/autostart/run.sh scripts/autostart/install.sh scripts/autostart/uninstall.sh scripts/autostart/rebuild.sh
```

- [ ] **Step 6: package.json에 스크립트 추가**

`package.json`의 `scripts`에 추가:
```json
"autostart:install": "bash scripts/autostart/install.sh",
"autostart:uninstall": "bash scripts/autostart/uninstall.sh",
"autostart:rebuild": "bash scripts/autostart/rebuild.sh"
```

- [ ] **Step 7: 스크립트 문법·안전 검증 (등록 없이)**

launchctl 등록은 하지 않는다(사용자 몫). 대신 셸 문법만 검증:
```bash
bash -n scripts/autostart/run.sh
bash -n scripts/autostart/install.sh
bash -n scripts/autostart/uninstall.sh
bash -n scripts/autostart/rebuild.sh
echo "syntax ok"
```
Expected: 에러 없이 `syntax ok` 출력.

또한 plist 렌더가 실제 값으로 유효한 XML을 만드는지 확인(등록은 안 함):
```bash
node scripts/autostart/render-plist.mjs com.kimjonggun.project-platform /opt/homebrew/bin "$(pwd)" 4319 "$HOME/Library/Logs/project-platform" | plutil -lint -
```
Expected: `- : OK` 출력(입력이 유효한 plist).

- [ ] **Step 8: Commit**

```bash
git add scripts/autostart/run.sh scripts/autostart/install.sh scripts/autostart/uninstall.sh scripts/autostart/rebuild.sh package.json
git commit -m "feat(autostart): 설치·해제·재빌드 스크립트와 npm 명령

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: 문서화 (README + project.json)

**Files:**
- Modify: `README.md`, `project.json`

**Interfaces:**
- Produces: 자동실행 사용법 문서, 진행도 갱신.

- [ ] **Step 1: README에 자동실행 섹션 추가**

`README.md`에 "## 부팅 자동실행 (macOS)" 섹션을 추가하고 다음을 기재:
- 설치: `npm run autostart:install` (로그인 시 `http://localhost:4319` 자동 구동)
- 해제: `npm run autostart:uninstall`
- 코드 수정 후 반영: `npm run autostart:rebuild`
- 개발 서버(`npm run dev`, 3000)와 자동실행(4319)은 포트가 달라 공존 가능
- 로그 위치: `~/Library/Logs/project-platform/{out,err}.log`
- 로드맵 표의 C 항목을 "완료"로 갱신.

- [ ] **Step 2: project.json 진행도 갱신**

`project.json`의 `progress`를 `20`에서 `35`로 올린다(A+B에 이어 C 완료 반영).

- [ ] **Step 3: 빌드·테스트 최종 확인**

Run: `npm test && npm run build`
Expected: 33 tests PASS, 빌드 성공.

- [ ] **Step 4: Commit**

```bash
git add README.md project.json
git commit -m "docs(autostart): 자동실행 사용법과 진행도 갱신

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (계획 검토)

**Spec coverage:**
- LaunchAgent plist 정확성: Task 1(렌더러 TDD) ✓
- run.sh(next start -p 4319): Task 2 Step 1 ✓
- install/uninstall/rebuild + 멱등 등록: Task 2 ✓
- 절대경로 구워넣기(PATH/WorkingDirectory): Task 1 렌더러 + Task 2 install이 NODE_BIN 결정 ✓
- 전용 포트 4319: Task 1·2 전반 ✓
- 브라우저 자동 열기 안 함: 스크립트에 미포함(암묵) ✓
- 부팅 등록은 사용자 실행: Task 2 Step 7이 등록 대신 문법·plutil 검증만 ✓
- 로그 경로: Task 1 렌더러 + Task 2 install의 LOG_DIR 생성 ✓
- 오류 처리(set -euo pipefail, macOS/노드 확인): Task 2 ✓
- 테스트(render-plist): Task 1 ✓
- 문서: Task 3 ✓

**Placeholder scan:** 모든 코드/명령 단계에 실제 내용 포함. "TBD/TODO" 없음. Task 3 README만 서술형(문서 작성 지시로 허용).

**Type consistency:** `renderPlist({label, nodeBin, appDir, port, logDir})` 시그니처가 Task 1 정의·테스트·CLI·Task 2 install 호출 인자 순서(label nodeBin appDir port logDir)와 일치. Label `com.kimjonggun.project-platform`, 포트 4319가 전 태스크에서 동일. plist 경로·로그 경로 문자열 일관.
