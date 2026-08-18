# 부팅 자동실행 (C) 설계

작성일: 2026-08-18
범위: 통합 플랫폼의 **2차 스펙** — 로그인(부팅) 시 대시보드를 자동 구동(macOS LaunchAgent).

## 배경

A+B(대시보드 + 규칙 검사)는 완료되어 main에 병합됨. 이 스펙은 "맥북 켜면 플랫폼이 동작"이라는 원래 요구를 구현한다. 나머지 D(프로젝트 추가)·E(실행 버튼)·F(Orca)는 각자 별도 스펙.

핵심 제약: 이 앱은 로컬 파일시스템을 읽는 로컬 서버다. 부팅 자동실행은 macOS의 사용자 레벨 LaunchAgent로 구현한다.

## 결정 사항 (브레인스토밍 확정)

- **구동 모드:** 사전 build 후 `next start`만. 설치 시 한 번 `npm run build`, 이후 부팅은 `next start`(빠름). 코드 수정 시 `rebuild` 스크립트로 재빌드.
- **포트:** 전용 포트 **4319**. 개발용 `npm run dev`(3000)와 충돌하지 않음. 접속: `http://localhost:4319`.
- **브라우저 자동 열기:** 하지 않음(YAGNI). 사용자가 필요할 때 접속.
- **부팅 등록 실행 주체:** 스크립트는 이 작업에서 작성하되, `~/Library/LaunchAgents/` 기록·launchctl 등록은 **사용자가 직접** `npm run autostart:install`로 실행한다(안전 게이트: 자동실행 등록은 시스템 변경).

## 아키텍처

```
scripts/autostart/
├─ render-plist.mjs      plist 문자열 생성 (순수 함수 → TDD 대상)
├─ render-plist.test.ts  Vitest 단위 테스트
├─ run.sh               launchd가 실제 실행: cd 앱루트 → npm run start -- -p 4319
├─ install.sh          build + plist 생성·설치 + launchctl 로드 (사용자 실행)
├─ uninstall.sh        launchctl 언로드 + plist 제거
└─ rebuild.sh          재빌드 + 서비스 재시작(코드 수정 반영)
```

launchd는 PATH·cwd가 없으므로, 설치 시점에 절대경로(`/opt/homebrew/bin` 등)를 plist의 `EnvironmentVariables`·`WorkingDirectory`에 구워 넣는다. 위험한 부분(plist 내용 정확성)은 `render-plist.mjs`를 순수 함수로 분리해 테스트한다.

package.json에 `autostart:install` / `autostart:uninstall` / `autostart:rebuild` 스크립트 추가.

## LaunchAgent (plist)

경로: `~/Library/LaunchAgents/com.kimjonggun.project-platform.plist` (설치 시 생성)

| 키 | 값 | 의미 |
|---|---|---|
| `Label` | `com.kimjonggun.project-platform` | 식별자 |
| `ProgramArguments` | `[/bin/bash, <앱>/scripts/autostart/run.sh]` | run.sh 실행 |
| `WorkingDirectory` | 앱 절대경로 | cwd 없음 문제 해결 |
| `EnvironmentVariables` | `PATH=<node_bin>:/usr/bin:/bin`, `PORT=4319`, `NODE_ENV=production` | PATH·포트 주입 |
| `RunAtLoad` | true | 로그인 시 즉시 |
| `KeepAlive` | true | 크래시 시 재시작 |
| `ThrottleInterval` | 10 | 크래시 루프 시 10초 간격(무한 폭주 방지) |
| `StandardOutPath` | `<logDir>/out.log` | 표준 출력 로그 |
| `StandardErrorPath` | `<logDir>/err.log` | 표준 에러 로그 |

- `<node_bin>`: 설치 시 `dirname $(which node)`로 결정.
- `<logDir>`: `~/Library/Logs/project-platform/` (install.sh가 생성).

**run.sh**:
```bash
#!/bin/bash
cd "$(dirname "$0")/../.." || exit 1
exec npm run start -- -p 4319
```

## render-plist.mjs

```
export function renderPlist({ label, node_bin, appDir, port, logDir }): string
```
- 입력 값으로 위 표의 plist XML 문자열을 생성.
- `appDir`/`logDir`에 공백·특수문자가 있어도 유효한 XML이 되도록 `&<>"` 를 이스케이프.
- ESM 모듈. install.sh가 `node render-plist.mjs`로 호출하거나, install.sh가 값을 인자로 넘겨 stdout으로 plist를 받는다.

## 설치/해제/재빌드 스크립트

- **install.sh**:
  1. macOS 확인(`uname` = Darwin), node/npm 존재 확인 — 아니면 명확한 에러로 종료.
  2. `npm install` + `npm run build`.
  3. `logDir` 생성. `render-plist.mjs`로 plist 생성해 LaunchAgents에 기록.
  4. 이미 로드돼 있으면 `launchctl bootout gui/$UID <plist>` 후 `launchctl bootstrap gui/$UID <plist>` (멱등).
  5. `curl -sf --retry 5 --retry-delay 2 localhost:4319`로 기동 확인. 성공 시 접속 주소 안내, 실패 시 로그 경로 안내.
- **uninstall.sh**: `launchctl bootout gui/$UID <plist>` (없어도 무시) + plist 삭제.
- **rebuild.sh**: `npm run build` 후 `launchctl kickstart -k gui/$UID/com.kimjonggun.project-platform`로 재시작.

## 오류 처리

- install.sh: macOS 아님/노드 없음/빌드 실패 시 비영번 종료 + 원인 출력. 재실행 안전(멱등).
- 부팅 시 포트 사용 중이면 `next start`가 실패 → err.log에 기록, KeepAlive가 ThrottleInterval 간격으로 재시도.
- 스크립트는 `set -euo pipefail`로 작성.

## 테스트 (web.md의 TDD)

- `render-plist.test.ts` (Vitest): 렌더된 plist가 올바른 `Label`·`ProgramArguments`(run.sh 경로)·`PORT=4319`·`WorkingDirectory`·`RunAtLoad`·로그 경로를 포함하는지, 경로에 공백/`&` 있을 때 XML 이스케이프가 유효한지 검증.
- launchctl 등록은 자동 테스트 불가 → 사용자가 `npm run autostart:install` 실행 후 `launchctl list | grep project-platform`, `curl localhost:4319`로 수동 확인.

## 비범위

- D(프로젝트 추가)·E(실행 버튼)·F(Orca 모바일). 부팅 시 브라우저 자동 열기. Linux/Windows 자동실행(현재 macOS 전용).
