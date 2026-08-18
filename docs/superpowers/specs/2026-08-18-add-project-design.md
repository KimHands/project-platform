# 프로젝트 추가 (D) 설계

작성일: 2026-08-18
범위: 통합 플랫폼의 **3차 스펙** — 플랫폼에서 새 프로젝트를 추가하면 로컬 맥에 규칙 준수 골격 폴더가 자동 생성된다(파일시스템 쓰기).

## 배경

A+B(대시보드·규칙검사), C(부팅 자동실행)는 main에 병합됨. 이 스펙은 "플랫폼에서 프로젝트를 추가하면 로컬에도 자동 추가"라는 요구를 구현한다. 이 기능은 플랫폼에서 **처음으로 파일시스템에 쓰는** 지점이라 안전 설계가 핵심이다. E(실행)·F(Orca)는 별도 스펙.

## 결정 사항 (브레인스토밍 확정)

- **생성 범위:** 규칙 준수 골격 — 폴더 + `CLAUDE.md`(`@AGENTS.md`) + `AGENTS.md`(제목·설명·"항상 지킬 것" 섹션) + `project.json`(설명·상태·태그). git init 안 함. 생성 즉시 규칙 검사 통과·대시보드에 표시됨.
- **입력:** 폴더명, 카테고리(project/career), 설명, 상태(기본 planning), 태그.
- **트리거:** 대시보드의 "+ 새 프로젝트" 버튼 → 모달 폼. 사용자 행동이 곧 안전 게이트(사람이 버튼 클릭).

## 아키텍처 (읽기/쓰기 분리)

스캐너(`lib/scanner`)의 읽기 전용 보장을 깨지 않기 위해 쓰기는 별도 모듈로 격리한다.

```
lib/creator/
├─ scaffold.ts            골격 파일 내용 생성 (순수 함수 → TDD)
│                         agentsMd(name, description) / claudeMd() / manifestJson({description,status,tags})
├─ validateNewProject.ts  이름·카테고리 검증 (순수) — checkRules의 FOLDER_RE 재사용
└─ createProject.ts       실제 폴더·파일 생성 (async, 쓰기 경로 유일)
```

- `app/api/projects/route.ts`에 **POST** 핸들러 추가(기존 GET 유지). POST가 `createProject` 호출.
- **작은 리팩터:** `checkRules.ts`의 `FOLDER_RE`(`/^[a-z0-9-]+$/`)를 export하여 `validateNewProject`가 동일 정규식 재사용 — 폴더명 규칙의 단일 출처.
- 쓰기는 오직 `lib/creator`에만 존재. `lib/scanner`는 계속 쓰기 없음.

## 데이터 모델 / 인터페이스

```
interface NewProjectInput {
  name: string          // 폴더명
  category: 'project' | 'career'
  description?: string
  status?: Status       // 기본 'planning'
  tags?: string[]
}

// validateNewProject(input): { ok: boolean; errors: string[]; targetName: string }
//   - 이름이 FOLDER_RE 불일치 → errors에 폴더명 규칙 위반
//   - category가 project|career 아님 → errors
//   - 존재 여부는 검사하지 않음(순수). 존재 검사는 createProject가 fs로.

// createProject(input, roots=ROOTS): Promise<{ path: string; folderName: string }>
//   - validateNewProject 실패 → throw CreateError('invalid', 상세)
//   - 대상 경로가 이미 존재 → throw CreateError('exists')
//   - 성공 → 폴더 + 3파일 생성 후 경로 반환
```

## 골격 파일 내용 (scaffold.ts)

- `claudeMd()` → `"@AGENTS.md\n"`
- `agentsMd(name, description)` →
  ```
  # <name>

  <description 또는 "(한 줄로 이 프로젝트가 무엇인지 적으세요)">

  ## 이 프로젝트에서 항상 지킬 것
  - 형식 규칙: `~/Ops/domains/` 에서 해당하는 것을 참조 (deck / hwp / web / paper)
  - (작업하다 "또 이걸 어겼네" 싶은 게 생기면 여기에 한 줄씩 추가하세요)
  ```
- `manifestJson({description, status, tags})` → `JSON.stringify({ description, status, tags }, null, 2)` (빈 값은 생략). 생성된 매니페스트는 `parseManifest`로 읽었을 때 `invalid: false`여야 한다.

## UI

- 대시보드 상단 "+ 새 프로젝트" 버튼 → 모달 폼(클라이언트 컴포넌트).
- 필드: 폴더명(입력 중 `FOLDER_RE`로 실시간 검증·에러 표시) · 카테고리 · 설명 · 상태(select) · 태그(쉼표 구분).
- **생성 위치 미리보기**: `~/Desktop/Projects/<name>` (카테고리에 따라 경로 갱신) — 사용자가 경로를 보고 클릭.
- 제출 → `POST /api/projects` → 성공: `router.refresh()` + 새 프로젝트 상세(`/project/<name>`)로 이동. 실패: 폼에 에러 메시지.

## 안전 & 오류 처리 (핵심)

- **경로 안전:** 이름은 `/^[a-z0-9-]+$/`만 허용 → `/`·`..`·`.`·공백·한글 원천 차단. 대상경로 = `path.join(root, name)` 계산 후 `path.resolve`된 경로가 **여전히 root 바로 아래**인지 재검증(방어 심층화). 아니면 거부.
- **덮어쓰기 금지:** 대상 폴더가 이미 존재하면 409(`code: 'exists'`). 절대 덮어쓰지 않음.
- **범위 제한:** 카테고리는 설정된 두 root 중 하나만. 쓰기는 오직 그 두 root 아래에서만.
- 설명·태그는 데이터로만 기록(JSON·마크다운). 경로 구성 요소는 이름 하나뿐.
- API 오류는 구조화 JSON `{ error: string, code: 'invalid'|'exists'|'server' }` + 적절한 HTTP 상태(400/409/500). UI가 표시.

## 테스트 (web.md의 TDD)

- `scaffold.ts`: `agentsMd`가 이름·설명 포함, `claudeMd() === '@AGENTS.md\n'`, `manifestJson` 결과가 `parseManifest`로 라운드트립 시 `invalid: false`.
- `validateNewProject`: 정상 / 대문자·한글·슬래시·`..`·공백 이름 거부 / 잘못된 카테고리 거부.
- `createProject`(임시 root 통합): 기대 3파일 생성, 기존 폴더 존재 시 `exists` throw, traversal 이름 거부, 생성된 폴더를 `scanProjects`가 스캔하면 규칙 위반 없이 나옴.

## 비범위

- E(실행 버튼)·F(Orca). 기존 프로젝트 편집·삭제(생성만). 대시보드에서 설명/진행도 인라인 편집. 템플릿 선택(Next/Python 등 스캐폴딩) — 지금은 빈 골격만.
