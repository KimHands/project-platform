# project-platform

로컬 프로젝트 폴더를 스캔해 기술스택·진행도·규칙 위반을 웹 대시보드로 보여주는 플랫폼.

## 이 프로젝트에서 항상 지킬 것
- 형식 규칙: `~/Ops/domains/` 에서 해당하는 것을 참조 (deck / hwp / web / paper)
- (작업하다 "또 이걸 어겼네" 싶은 게 생기면 여기에 한 줄씩 추가하세요)

## Orca 중복 방지 원칙 (근거: docs/orca-boundary.md)
- **상태·진행도의 원천은 `project.json` 단일.** Orca workspaceStatus와 양방향 동기화하지 않는다(이중 원천 금지). project.json이 더 표현력 있고(progress 0-100·planning/paused) 모든 폴더를 덮고 git 추적됨.
- **러너(`/api/run`)는 스코프 동결: run/stop/logs/port 까지만.** 멀티터미널·에이전트 오케스트레이션·워크트리 세션으로 키우지 않는다 — 그건 Orca 영역. "에이전트를 워크트리에서 돌리기" 요구는 Orca bridge(`/api/orca`)로 위임한다.
- **Orca와 겹치는 라이브 상태는 자체 구현 대신 읽기 전용으로 Orca에서 빌려온다**(bridge). 
- **우리 고유 레이어에 집중:** 디스크 전체 스캔(Orca 미등록 폴더 포함)·규칙 감사(폴더명·CLAUDE.md/@AGENTS.md·~Ops 운용규칙)·기술스택 감지. Orca에 없는 기능이 존재 이유.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
