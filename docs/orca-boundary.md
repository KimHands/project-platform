# Orca 경계 — 중복 방지 결정

작성일: 2026-08-24
결정: project-platform과 Orca(작업 프로그램)의 기능 경계를 고정한다. (조사·판단만 수행, 코드 변경 없음)

## 배경

project-platform은 이미 Orca bridge(`/api/orca`)로 Orca를 호출한다. 동시에 자체 상태 보드(project.json status/progress)와 러너(`/api/run`)를 갖고 있어, "Orca를 감싸면서 같은 기능을 자체 구현"하는 이중 구조 위험이 제기됐다.

## 실측 (2026-08-24, Orca v1.4.188)

- `orca worktree ps --json`은 워크트리마다 `workspaceStatus`(todo/in-progress/in-review/completed)·`comment`·`agents[].state`·`liveTerminalCount`·`lastActivityAt`·터미널 `preview`를 준다.
- `orca worktree set --workspace-status <id> --comment <text>` 로 보드 상태·코멘트를 CLI로 쓸 수 있다(양방향 기술적 가능).
- `orca terminal create --command / read / wait / stop / close / split` — 러너 상당 기능. 단 **등록된 워크트리 대상만**.
- **범위 격차:** 디스크 폴더 33개(Projects 31 + Career 2) 중 Orca가 아는 워크트리는 13개 → **약 20개는 Orca 미등록**. project-platform의 스캔·규칙 감사는 33개 전부를 덮는다.

## Orca가 못 하는 것 = 우리 존재 이유 (계속 밀 것)

- 디스크 전체 폴더 스캔(Orca 미등록 폴더까지). Orca는 등록된 repo/worktree만 안다.
- 규칙 위반 감지(폴더명 ASCII 규칙, CLAUDE.md/@AGENTS.md 유무, ~Ops 운용규칙 코드화). Orca에 전혀 없음.
- 기술스택 자동 감지·집계.

## 결정

1. **상태·진행도 원천 = `project.json` 단일.** Orca workspaceStatus와 양방향 동기화하지 않는다. project.json이 progress(0-100)·planning/paused까지 표현하고, 모든 폴더를 덮고, git 추적된다. Orca 보드는 부분집합 뷰일 뿐. (현재 동기화 안 함 = 활성 이중화 버그 없음. 이 결정은 미래 도입을 막는 예방.)
2. **러너(`/api/run`) 스코프 동결: run/stop/logs/port 까지만.** 멀티터미널·에이전트 오케스트레이션·워크트리 세션으로 키우지 않는다. 우리 러너의 핵심 가치는 "Orca 미등록 폴더도, Orca 꺼져 있어도 클릭 한 번에 구동". 그 이상(에이전트를 워크트리에서 돌리기)은 Orca bridge로 위임.
3. **겹치는 라이브 상태는 자체 구현 금지 → 읽기 전용으로 Orca에서 빌려온다**(향후 필요 시 bridge로). 중복이 아니라 보완.
4. **집중 레이어:** 스캔 집계 + 규칙 감사 + 기술스택 — Orca와 안 겹치는 곳.

## 지금 하지 않은 것

- 읽기 전용 Orca 라이브 배지(에이전트 상태·터미널 수 표시)는 유효한 후속 후보이나 이번엔 구현하지 않음(별도 사이클 필요 시 진행).
- 상태 동기화 코드는 도입하지 않음(원천 단일 유지).
