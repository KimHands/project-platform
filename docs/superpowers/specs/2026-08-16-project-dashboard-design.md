# 프로젝트 대시보드 (A+B) 설계

작성일: 2026-08-16
범위: 로컬 맥 프로젝트를 웹에서 시각화하는 통합 플랫폼의 **1차 스펙** — (A) 읽기 전용 대시보드 + (B) 워크플로우 규칙 검사.

## 배경과 범위

전체 플랫폼은 여러 독립 하위 시스템으로 구성된다: A(시각화), B(규칙 검사), C(부팅 자동실행 launchd), D(플랫폼→로컬 폴더 생성), E(프로젝트 실행 버튼), F(Orca 모바일 연동). 통째로 한 스펙으로 만들지 않고 조각별로 스펙→계획→구현 사이클을 돈다.

**이 스펙은 A+B만 다룬다.** 나머지(C·D·E·F)는 각자 별도 스펙에서. 단, 데이터 모델은 미래 확장을 고려해 설계한다(예: `run` 필드는 지금 표시만 하고 E에서 활성화).

핵심 제약: 이 플랫폼은 로컬 파일시스템에 접근해야 하므로 순수 웹 배포가 아니라 **맥에서 도는 로컬 서버 + 웹 UI** 구조다.

## 스택

**Next.js(App Router) 단일 앱.** API Route가 스캐너를 호출하고, 같은 앱이 UI를 렌더한다. `next start`로 로컬 구동. 선정 이유: 미래 확장(C는 `next start`를 데몬화, F는 같은 서버에 API 추가)이 자연스럽고, shadcn/ui + Tailwind로 가독성 높은 UI를 빠르게 만든다. 핵심 스캐너 로직은 스택과 무관한 순수 TS 모듈로 분리해 TDD로 테스트한다.

## 아키텍처

```
project-platform/
├─ lib/scanner/          순수 TS, TDD 대상 (Next와 무관하게 테스트)
│  ├─ detectStack.ts     마커 파일 → 기술스택 목록
│  ├─ parseManifest.ts   project.json 읽기·검증, 없으면 폴백
│  ├─ readGit.ts         git 정보 읽기 전용 (branch, 최근커밋, dirty, commitCount)
│  ├─ checkRules.ts      워크플로우 규칙 위반 검사
│  └─ scanProjects.ts    루트 폴더 순회 → ProjectInfo[] 조립
├─ app/api/projects/route.ts   스캐너 호출 → JSON
├─ app/page.tsx                 대시보드 그리드
├─ app/project/[name]/          상세 뷰
└─ config.ts             스캔 루트 목록
```

**데이터 흐름:** 브라우저 → `/api/projects` → `scanProjects()` → 각 폴더마다 (자동감지 + 매니페스트 + git + 규칙) 병합 → `ProjectInfo[]` 반환 → 카드 렌더.

**쓰기 경로 없음.** 스캐너는 파일시스템을 읽기만 한다(web.md의 read-only 원칙). DB 없음.

**설정(`config.ts`):** 스캔 루트 목록. 기본값 `~/Desktop/Projects`(category: project), `~/Desktop/Career`(category: career). 각 루트의 1단계 하위 디렉터리가 프로젝트 단위. `.DS_Store` 등 파일·숨김폴더는 제외.

## 데이터 모델

### `project.json` (각 프로젝트 루트, 전부 optional)

```json
{
  "description": "키 없이 즐기는 플레이 데모",
  "status": "active",
  "progress": 60,
  "run": { "cmd": "npm run dev", "port": 3000 },
  "stack": ["next", "postgres"],
  "tags": ["security"]
}
```

- `status`: `planning | active | paused | done` 중 하나. 없으면 git 활동으로 추정.
- `progress`: 0~100 정수. 없으면 `null` → UI에서 `—`. **가짜 숫자를 만들지 않는다.**
- `run`: 미래 E용. 지금은 상세 뷰에 명령을 표시만 하고 버튼은 비활성.
- `stack`: 자동 감지 결과에 추가/보정(병합·중복제거).
- 깨진 JSON이면 파싱 실패로 처리하고 규칙 위반(warn)으로 표면화한다. 크래시하지 않는다.

### `ProjectInfo` (스캐너가 계산해 UI로 반환)

```
path            프로젝트 절대경로
folderName      실제 폴더명(규칙 검사 대상)
name            표시 이름(매니페스트 없으면 folderName)
category        project | career
description     매니페스트 값, 없으면 빈 문자열
status          planning | active | paused | done
progress        number | null
stack           [{ id, label, icon }]  (감지 + 매니페스트 병합·중복제거)
runnable        boolean  (run.cmd 있으면 true)
git             { branch, lastCommit(상대시간 문자열), dirty(boolean), commitCount } | null
rules           [{ id, level: 'error'|'warn', message }]
hasManifest     boolean
```

### 자동 감지 마커

| 마커 파일 | 감지 |
|---|---|
| package.json | node — deps에서 next/react/vue/express 세부 구분 |
| requirements.txt, pyproject.toml | python |
| go.mod | go |
| Cargo.toml | rust |
| pom.xml, build.gradle | java |
| Dockerfile | docker |
| index.html (그 외 없을 때) | static web |

진행도(`progress`)는 매니페스트에만 의존한다. 없으면 git 활동으로 `status`만 추정(최근 커밋 → active, 오래됨 → paused), `progress`는 `null`.

## 규칙 검사 (B)

전역 CLAUDE.md 법칙을 코드로 검사한다.

| id | 레벨 | 조건 |
|---|---|---|
| folder-name-format | error | 폴더명에 ASCII 소문자·숫자·하이픈 외 문자(한글/대문자/공백/언더스코어 등)가 있으면 위반 |
| claudemd-exists | warn | 루트에 CLAUDE.md 없으면 |
| claudemd-first-line | warn | CLAUDE.md 첫 줄이 `@AGENTS.md`가 아니면 |
| agentsmd-exists | warn | 루트에 AGENTS.md 없으면 |
| manifest-invalid | warn | project.json이 있으나 JSON 파싱/스키마 검증 실패 |

- 각 프로젝트 카드에 위반 배지, 상세 뷰에 전체 목록.
- 대시보드 상단에 "규칙 위반 N개" 요약.
- 위치 규칙(Projects↔Career 소속)은 자동 판정이 애매하므로 소속 루트만 표시하고 강제하지 않는다.

## UI

- **그리드 카드**, 카테고리별 그룹 (Projects / Career).
- 카드 구성: 이름 · 상태 배지(색상) · 진행도 바(없으면 `—`) · 기술스택 아이콘 행 · git 신선도 · 규칙 경고 배지 · 매니페스트 없으면 흐릿한 시각 표시.
- 상단: 검색 + 필터/정렬(상태별 · 규칙위반순 · 최근활동순).
- 카드 클릭 → 상세 뷰: 전체 설명 · 전체 스택 · git 정보 · 규칙 목록 전체 · 실행 명령(표시만, 버튼은 "곧" 비활성 — E에서 활성화).
- shadcn/ui + Tailwind, 다크 지원. 기술 아이콘은 simple-icons / devicons.

## 테스트 (web.md의 TDD)

스캐너 각 모듈은 실패 테스트 먼저 작성:

- `detectStack`: 마커 파일별 감지, 복수 마커, 마커 없음.
- `parseManifest`: 정상 / 깨진 JSON / 파일 없음 / 스키마 위반.
- `checkRules`: 규칙별 위반·통과 케이스.
- `readGit`: git 없는 폴더는 `null` 반환.
- `scanProjects`: 임시 fixture 디렉터리로 통합 테스트. 스캐너가 파일시스템에 절대 쓰지 않음을 보장(읽기 전용 검증).

## 비범위 (이 스펙에서 하지 않음)

- C: 부팅 시 자동 실행(launchd)
- D: 플랫폼에서 프로젝트 추가 → 로컬 폴더 생성(쓰기)
- E: 실행 버튼(프로세스 관리·포트)
- F: Orca 모바일 연동
- 대시보드에서 설명/진행도 직접 편집(쓰기)

이들은 각자 별도 스펙에서 다룬다.
