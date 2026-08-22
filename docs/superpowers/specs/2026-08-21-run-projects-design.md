# 프로젝트 실행 (E) 설계

작성일: 2026-08-21
범위: 통합 플랫폼의 **4차 스펙**(마지막 하위 시스템) — 대시보드 상세 뷰에서 "동작" 버튼으로 실행 가능한 프로젝트를 로컬에서 구동하고, 상태·로그·포트 링크를 본다.

## 배경

A+B·C·D·F는 main에 병합됨. 이 스펙은 "구동 가능한 프로젝트면 플랫폼에서 동작 버튼을 눌러 확인" 요구(E)를 구현한다. 상세 뷰에는 이미 `p.runnable`일 때 비활성 "동작 (곧 지원)" 버튼 자리가 있고, 매니페스트 스키마에 `run:{cmd,port}`가 있다(현재 이 저장소 project.json에 `{cmd:'npm run dev', port:3000}`).

E는 플랫폼에서 **임의 로컬 명령을 실행**하는 기능이라 보안이 핵심이다.

## 보안 / 신뢰 모델 (핵심)

명령을 검열하는 게 아니라(실행이 목적) **출처와 트리거**를 제한한다:

- **명령은 오직 그 프로젝트의 `project.json` `run.cmd`에서만.** 웹 요청은 `folderName`만 전달 → 서버가 그 프로젝트의 매니페스트를 재파싱해 cmd를 얻는다. **클라이언트가 명령 문자열을 보낼 수 없다**(주입 불가).
- 실행 폴더는 설정된 두 root(`~/Desktop/Projects`·`~/Desktop/Career`) 아래의 그 프로젝트 경로뿐. `folderName`은 기존 `FOLDER_RE`(`/^[a-z0-9-]+$/`)로 검증 → `/`·`..`·`.` 차단. 경로는 `path.dirname(resolve)`가 root 바로 아래인지 재검증(방어 심층화).
- 시작은 **명시적 사용자 클릭**. 상세 뷰에 실행 전 **"실행할 명령"과 cwd를 그대로 표시**(투명성).
- `run.cmd`는 사용자가 직접 쓴 신뢰된 파일이므로 `spawn(cmd, { shell: true, cwd: projectPath, detached: true })`로 실행(npm 스크립트 등 지원). "자기 project.json에 쓴 명령을 자기 맥에서 돌리는" 로컬 러너.

## 아키텍처

```
lib/runner/          서버 전용, 프로세스 실행/관리
├─ resolveRun.ts      folderName → { projectPath, cmd, port } (경로안전·매니페스트, 얇음)
└─ runManager.ts      프로젝트별 detached 프로세스그룹 start/stop/getRunState + tailLog
```

- F의 `serveManager` 패턴 재사용: **detached + 프로젝트별 상태파일**(대시보드 꺼져도 유지), 로그 `~/.project-platform/runs/<folderName>.log`, 상태 `~/.project-platform/runs/<folderName>.json`.
- **여러 프로젝트 동시 실행 가능**(각자 프로세스). 프로젝트당 단일 인스턴스(이미 running이면 기존 상태 반환).
- stop은 **프로세스 그룹 kill**(`kill(-pid, SIGTERM)`) — npm이 띄운 자식까지 정리. 시작 시 `detached:true`로 새 프로세스 그룹 생성.

## 데이터 모델 / 인터페이스

```
interface RunTarget { projectPath: string; cmd: string; port: number | null }
interface RunState { folderName: string; running: boolean; pid: number | null; port: number | null; startedAt: number | null }

// resolveRun(folderName, roots=ROOTS): Promise<RunTarget>
//   - FOLDER_RE 불일치 → RunError('invalid')
//   - root 아래 그 폴더 없음 → RunError('not-found')
//   - 매니페스트 run.cmd 없음 → RunError('not-runnable')
// class RunError extends Error { code: 'invalid'|'not-found'|'not-runnable'|'server' }

// startRun(folderName, deps?): Promise<RunState>   // 이미 running이면 기존 반환; 아니면 그룹 detached spawn
// stopRun(folderName, deps?): Promise<RunState>    // 프로세스 그룹 kill + 상태 정리
// getRunState(folderName, deps?): Promise<RunState> // 상태파일 + pid 생존 확인(죽었으면 running:false 정리)
// tailLog(folderName, lines=200): Promise<string>
```

`ProjectInfo`에 `run?: { cmd: string; port: number | null }` 추가(상세 뷰가 명령·포트를 표시하도록). `buildProjectInfo`가 매니페스트의 `run`을 그대로 실어보냄. 스캐너는 계속 읽기 전용.

## API

- `POST /api/run` `{ folderName: string, action: 'start'|'stop' }`:
  - start: `resolveRun` 실패 → 매핑(invalid→400, not-found→404, not-runnable→400); 성공 시 `startRun` → 200 `RunState`.
  - stop: `stopRun` → 200 `RunState`.
  - 잘못된 body/action → 400 `{code:'invalid'}`. 기타 → 500 `{code:'server'}`.
- `GET /api/run?folderName=…` → `RunState`(상세 뷰 폴링).
- `GET /api/run/logs?folderName=…` → `{ log: string }`(마지막 N줄).
- 오류 형식 `{ error, code }`.

## UI (상세 뷰)

`app/project/[name]/page.tsx`의 실행 섹션을 활성화. 클라이언트 하위 컴포넌트 `components/RunControls.tsx`:
- **실행할 명령·cwd 표시**(투명성): 예 `npm run dev` · `~/Desktop/Projects/foo`.
- **동작/중지 버튼**. 실행 중이면 상태 배지 + PID.
- `run.port` 있으면 **`http://localhost:<port>` 열기 링크**(새 탭).
- **로그 tail**(폴링 표시).
- runnable 아니면 기존처럼 "실행 명령 미정의".

## 오류 처리

- 매니페스트 없음/`run.cmd` 없음 → not-runnable(400), 버튼 비활성.
- spawn 실패 → RunError('server'), 로그 경로 안내.
- 상태파일 pid가 죽어 있으면 running:false로 정리.
- 프로세스 그룹 kill 실패는 무시하고 상태 정리(멱등).

## 테스트 (web.md의 TDD)

- `resolveRun`(임시 root 통합): 정상 → {projectPath,cmd,port}; 잘못된/traversal 이름 → invalid; 없는 폴더 → not-found; run.cmd 없음 → not-runnable.
- `runManager`(주입 deps: spawn/kill/fs/now): startRun(→RunState, 그룹 detached spawn 목·상태 기록), 이미 running이면 기존 반환, stopRun(그룹 kill=`kill(-pid,…)` 확인·상태 정리), getRunState(dead-pid 정리), tailLog(마지막 N줄).
- 스캐너 회귀: `run` 필드 추가로 `buildProjectInfo` 테스트 보강(매니페스트 run → ProjectInfo.run).
- 실제 프로세스 구동·포트 확인은 사용자 검증(gstack로 UI 렌더까지).

## 비범위

- 포트 준비 완료 자동 감지·자동 브라우저 열기. 실행 로그 스트리밍(SSE). 대시보드 카드에서 직접 실행(상세 뷰에서만). 프로젝트 외부 임의 명령 실행.
