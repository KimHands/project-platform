# UI 리디자인 (글래스+그라데이션 다크) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대시보드·상세·모달 전체 UI를 다크 글래스모피즘 + 그라데이션으로 리스타일한다(순수 비주얼, 동작 불변).

**Architecture:** `app/globals.css`에 그라데이션 캔버스 + 재사용 글래스/액센트 유틸을 정의하고(파운데이션), 각 컴포넌트는 하드코딩 라이트 클래스를 그 유틸 + 다크 팔레트로 교체한다. 마크업 구조·로직·props·핸들러는 그대로 둔다.

**Tech Stack:** Tailwind v4(`@import "tailwindcss"` + `@theme`), Next.js 16, Geist Sans/Mono(이미 로드), 커스텀 CSS 유틸. 새 의존성 없음.

## Global Constraints

- **순수 비주얼.** 동작·API·상태 로직·데이터 흐름·라우팅·props·핸들러 변경 금지. 스캐너/러너/Orca/creator 로직 불변.
- 기존 **87개 테스트가 그대로 통과**해야 한다(CSS/마크업 변경은 로직 테스트에 무영향). 각 태스크 후 `npm test`로 확인.
- 새 의존성 추가 없음. QR은 기존 `qrcode.react` 유지.
- 다크 베이스. 본문 텍스트 거의 흰색, 보조는 흐리게. 유리 위 대비·포커스 링 확보.
- 재사용 유틸(Task 1이 정의): `.glass`, `.glass-hover`, `.accent-gradient`, `.accent-text`, `.progress-track`, `.progress-fill`, `.text-dim`, `.text-faint`.
- 각 태스크 검증: `npm run build` 성공 + `npm test` 회귀 없음 + gstack 스크린샷. 실제 실행 버튼 클릭/프로세스 시작 금지.
- 커밋 트레일러 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## Task 1: 파운데이션 — globals.css + 폰트 버그 수정

**Files:**
- Modify: `app/globals.css` (전체 교체), `app/layout.tsx` (body 클래스)

**Interfaces:**
- Produces: 유틸 클래스 `.glass`, `.glass-hover`, `.accent-gradient`, `.accent-text`, `.progress-track`, `.progress-fill`, `.text-dim`, `.text-faint`, CSS 변수(`--text`, `--text-dim`, `--glass-*`, `--accent-*`), 다크 그라데이션 배경.

- [ ] **Step 1: globals.css 전체 교체**

`app/globals.css`:
```css
@import "tailwindcss";

:root {
  --bg-base: #0b0b13;
  --text: #f4f4f8;
  --text-dim: rgba(244, 244, 248, 0.66);
  --text-faint: rgba(244, 244, 248, 0.42);
  --glass-bg: rgba(255, 255, 255, 0.05);
  --glass-bg-strong: rgba(255, 255, 255, 0.08);
  --glass-border: rgba(255, 255, 255, 0.10);
  --accent-from: #6366f1;
  --accent-to: #d946ef;
}

@theme inline {
  --color-background: var(--bg-base);
  --color-foreground: var(--text);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

body {
  min-height: 100vh;
  color: var(--text);
  font-family: var(--font-geist-sans), system-ui, -apple-system, sans-serif;
  background-color: var(--bg-base);
  background-image:
    radial-gradient(55rem 55rem at 12% -10%, rgba(99, 102, 241, 0.22), transparent 60%),
    radial-gradient(48rem 48rem at 112% 8%, rgba(217, 70, 239, 0.16), transparent 55%),
    radial-gradient(42rem 42rem at 50% 120%, rgba(34, 211, 238, 0.12), transparent 60%);
  background-attachment: fixed;
}

.glass {
  background: var(--glass-bg);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid var(--glass-border);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.06);
}
.glass-strong { background: var(--glass-bg-strong); }
.glass-hover { transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease; }
.glass-hover:hover {
  transform: translateY(-2px);
  border-color: rgba(255, 255, 255, 0.20);
  box-shadow: 0 16px 44px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.accent-gradient { background-image: linear-gradient(135deg, var(--accent-from), var(--accent-to)); }
.accent-text {
  background-image: linear-gradient(135deg, var(--accent-from), var(--accent-to));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.progress-track { background: rgba(255, 255, 255, 0.08); }
.progress-fill { background-image: linear-gradient(90deg, var(--accent-from), var(--accent-to)); }

.text-dim { color: var(--text-dim); }
.text-faint { color: var(--text-faint); }

::selection { background: rgba(217, 70, 239, 0.35); }
```

- [ ] **Step 2: layout.tsx body 클래스 정리**

`app/layout.tsx`의 `<body>` 줄을 다음으로(전역 텍스트/폰트는 globals가 처리하므로 body는 레이아웃만):
```tsx
      <body className="min-h-full flex flex-col font-sans">{children}</body>
```

- [ ] **Step 3: 빌드·테스트·시각 확인**

Run: `npm test` → 87 pass (회귀 없음).
Run: `npm run build` → 성공.
gstack로 `npm run dev`(3000) 후 `http://localhost:3000` 열어 **배경 그라데이션이 어둡게 깔리는지** 스크린샷(카드는 아직 라이트 상태여도 OK — 다음 태스크에서 교체). dev 종료.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css app/layout.tsx
git commit -m "style: 다크 글래스 파운데이션(그라데이션 캔버스·글래스 유틸·폰트 수정)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: 대시보드 페이지 (헤더·요약·섹션)

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: Task 1 유틸. `scanProjects`, `ProjectCard`, `countErrors/Warns`, `NewProjectDialog`, `OrcaPanel`(모두 기존). 로직 불변.

- [ ] **Step 1: page.tsx의 return 마크업 교체 (로직/import 유지)**

`app/page.tsx`의 `return (...)` 블록만 다음으로 교체. 상단 import·데이터 계산부(`projects`, `totalErrors`, `totalWarns`, `groups`)는 그대로 둔다:
```tsx
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="accent-text text-3xl font-bold tracking-tight">프로젝트 대시보드</h1>
          <p className="text-dim mt-1 text-sm">로컬 프로젝트를 한눈에 — 기술스택·진행도·규칙</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="glass rounded-full px-4 py-2 font-mono text-xs text-dim">
            위반 <b className="text-rose-400">{totalErrors}</b> · 경고{' '}
            <b className="text-amber-400">{totalWarns}</b> · 총 {projects.length}
          </div>
          <NewProjectDialog />
        </div>
      </header>
      <div className="mb-8"><OrcaPanel /></div>
      {groups.map(([cat, label]) => {
        const items = projects.filter((p) => p.category === cat)
        if (items.length === 0) return null
        return (
          <section key={cat} className="mb-10">
            <h2 className="text-dim mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest">
              <span className="accent-gradient h-1.5 w-1.5 rounded-full" />
              {label}
              <span className="text-faint font-normal normal-case tracking-normal">({items.length})</span>
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((p) => <ProjectCard key={p.path} p={p} />)}
            </div>
          </section>
        )
      })}
    </main>
  )
```

- [ ] **Step 2: 빌드·테스트·시각 확인**

Run: `npm test` → 87 pass.
Run: `npm run build` → 성공.
gstack로 대시보드 스크린샷 — 그라데이션 타이틀·글래스 요약 pill·섹션 헤더 확인(카드는 Task 3 전이라 아직 라이트여도 OK). dev 종료.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "style: 대시보드 헤더·요약·섹션 글래스화

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: ProjectCard + StatusBadge + StackIcons

**Files:**
- Modify: `components/ProjectCard.tsx`, `components/StatusBadge.tsx`, `components/StackIcons.tsx`

**Interfaces:**
- Consumes: Task 1 유틸. props·로직 불변(`p: ProjectInfo`, `status`, `stack`).

- [ ] **Step 1: StatusBadge.tsx 교체 (글로우 점 + 반투명 pill)**

`components/StatusBadge.tsx`:
```tsx
import type { Status } from '@/lib/scanner/types'

const STYLE: Record<Status, string> = {
  planning: 'bg-slate-400/10 text-slate-300 ring-slate-400/20',
  active: 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/20',
  paused: 'bg-amber-400/10 text-amber-300 ring-amber-400/20',
  done: 'bg-violet-400/10 text-violet-300 ring-violet-400/20',
}
const DOT: Record<Status, string> = {
  planning: 'bg-slate-400', active: 'bg-emerald-400', paused: 'bg-amber-400', done: 'bg-violet-400',
}
const LABEL: Record<Status, string> = {
  planning: '기획', active: '진행중', paused: '중단', done: '완료',
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLE[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[status]} shadow-[0_0_6px] shadow-current`} />
      {LABEL[status]}
    </span>
  )
}
```

- [ ] **Step 2: StackIcons.tsx 교체 (글래스 chip)**

`components/StackIcons.tsx`:
```tsx
import type { StackItem } from '@/lib/scanner/types'

export function StackIcons({ stack }: { stack: StackItem[] }) {
  if (stack.length === 0) return <span className="text-faint text-xs">스택 미상</span>
  return (
    <div className="flex flex-wrap gap-1.5">
      {stack.map((s) => (
        <span key={s.id} title={s.label}
          className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-xs text-dim">
          <img alt={s.label} width={12} height={12} className="opacity-90"
            src={`https://cdn.simpleicons.org/${s.icon}/ffffff`} />
          {s.label}
        </span>
      ))}
    </div>
  )
}
```
(주: simpleicons CDN에 `/ffffff`를 붙여 어두운 배경에서 흰 아이콘으로 렌더. 로직·매핑 동일.)

- [ ] **Step 3: ProjectCard.tsx 교체 (글래스 카드)**

`components/ProjectCard.tsx`의 import·`errors/warns` 계산은 유지하고 `return`을 다음으로:
```tsx
  return (
    <Link href={`/project/${p.folderName}`}
      className={`glass glass-hover block rounded-2xl p-4 ${p.hasManifest ? '' : 'opacity-60'}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="truncate font-semibold text-white">{p.name}</h3>
        <StatusBadge status={p.status} />
      </div>
      {p.description && <p className="text-dim mb-3 line-clamp-2 text-sm">{p.description}</p>}
      <div className="mb-3">
        {p.progress === null ? (
          <span className="text-faint font-mono text-xs">진행도 —</span>
        ) : (
          <div className="flex items-center gap-2">
            <div className="progress-track h-1.5 flex-1 overflow-hidden rounded-full">
              <div className="progress-fill h-full rounded-full" style={{ width: `${p.progress}%` }} />
            </div>
            <span className="text-dim font-mono text-xs">{p.progress}%</span>
          </div>
        )}
      </div>
      <StackIcons stack={p.stack} />
      <div className="text-faint mt-3 flex items-center justify-between font-mono text-xs">
        <span className="truncate">{p.git ? `${p.git.branch} · ${p.git.lastCommit}` : 'git 없음'}</span>
        <span className="flex shrink-0 gap-1">
          {errors > 0 && <span className="rounded bg-rose-500/15 px-1.5 text-rose-300">위반 {errors}</span>}
          {warns > 0 && <span className="rounded bg-amber-500/15 px-1.5 text-amber-300">경고 {warns}</span>}
        </span>
      </div>
    </Link>
  )
```

- [ ] **Step 4: 빌드·테스트·시각 확인**

Run: `npm test` → 87 pass.
Run: `npm run build` → 성공.
gstack로 대시보드 스크린샷 — 글래스 카드·상태 글로우 점·그라데이션 진행도바·스택 chip·흰 아이콘 가독 확인. dev 종료.

- [ ] **Step 5: Commit**

```bash
git add components/ProjectCard.tsx components/StatusBadge.tsx components/StackIcons.tsx
git commit -m "style: 글래스 카드·상태 배지·스택 chip

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: OrcaPanel + RunControls 리스타일

**Files:**
- Modify: `components/OrcaPanel.tsx`, `components/RunControls.tsx`

**Interfaces:**
- Consumes: Task 1 유틸. **모든 hook·state·fetch·핸들러·조건 분기·props는 그대로 두고 className/마크업 래핑만 교체.**

- [ ] **Step 1: OrcaPanel.tsx 리스타일 (로직 불변)**

`components/OrcaPanel.tsx`를 열어 **JSX className만** 다음 규칙으로 교체(구조·조건·핸들러 유지):
- 최상위 패널 컨테이너: `rounded-xl border p-4` → `glass rounded-2xl p-5`.
- 로딩 상태 컨테이너도 `glass rounded-2xl p-4 text-dim text-sm`.
- 제목 `<h2>`: `text-white font-semibold`.
- 상태 배지(설치/미설치): 설치 → `bg-emerald-400/10 text-emerald-300 ring-1 ring-inset ring-emerald-400/20`, 미설치 → `bg-white/5 text-dim ring-1 ring-inset ring-white/10` (둘 다 `rounded-full px-2 py-0.5 text-xs`).
- 도달 주소·안내 문구: `text-dim`/`text-faint`, 경로·주소 값은 `font-mono`.
- "원격 이어가기 시작" 버튼: `accent-gradient rounded-lg px-3 py-1.5 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-40`.
- "중지" 버튼: `rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/15`.
- 경고 문구(노출): `text-amber-300 text-xs`.
- 브라우저 URL `<code>`: `font-mono text-xs text-dim break-all`.
- QR(`QRCodeSVG`) 감싸는 요소: **흰 배경 카드** `rounded-lg bg-white p-2 inline-block`(스캔성). QR 자체 props 불변.
- 에러 문구: `text-rose-300 text-sm`.
- 저장된 환경 목록: 구분선 `border-t border-white/10`, 항목 `text-dim text-xs font-mono`.
로직/`useEffect`/`fetch`/`act`/상태 변수는 한 글자도 바꾸지 않는다.

- [ ] **Step 2: RunControls.tsx 리스타일 (로직 불변)**

`components/RunControls.tsx`의 JSX className만 교체(구조·핸들러·polling 유지):
- 실행 명령/경로 줄: `text-faint text-xs`, `<code>`·경로는 `font-mono`.
- "동작" 버튼: `accent-gradient rounded-lg px-3 py-1.5 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-40`.
- "중지" 버튼: `rounded-lg bg-rose-500/80 px-3 py-1.5 text-sm text-white hover:bg-rose-500`.
- "실행 중 (PID …)" 배지: `text-emerald-300 text-xs font-mono`.
- 포트 링크: `text-xs font-mono text-fuchsia-300 underline hover:text-fuchsia-200`.
- 에러: `text-rose-300 text-sm`.
- 로그 `<pre>`: `glass max-h-48 overflow-auto rounded-lg p-3 font-mono text-xs text-emerald-200/90`.

- [ ] **Step 3: 빌드·테스트·시각 확인**

Run: `npm test` → 87 pass.
Run: `npm run build` → 성공.
gstack로 대시보드(상단 Orca 패널) + 상세 뷰(`/project/project-platform`, 실행 섹션) 스크린샷. **동작/시작 버튼은 클릭하지 말 것.** dev 종료.

- [ ] **Step 4: Commit**

```bash
git add components/OrcaPanel.tsx components/RunControls.tsx
git commit -m "style: Orca 패널·실행 컨트롤 글래스화

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: 상세 뷰 + NewProjectDialog 리스타일

**Files:**
- Modify: `app/project/[name]/page.tsx`, `components/NewProjectDialog.tsx`

**Interfaces:**
- Consumes: Task 1 유틸. 로직·props·라우팅·notFound·핸들러 불변.

- [ ] **Step 1: 상세 뷰 리스타일 (로직 불변)**

`app/project/[name]/page.tsx`의 JSX className만 교체(데이터·`notFound()`·`RunControls` 사용 유지):
- `<main>`: `mx-auto max-w-3xl px-6 py-10`.
- "← 대시보드" 링크: `text-dim text-sm hover:text-white`.
- 프로젝트 제목 `<h1>`: `text-2xl font-bold text-white`.
- 경로 `<p>`: `text-faint font-mono text-sm`.
- 설명: `text-dim`.
- 각 `<section>`: `glass mb-4 rounded-2xl p-5` 로 감싸고, 섹션 제목 `<h2>`는 `text-dim mb-3 text-sm font-semibold uppercase tracking-widest`.
- Git 목록·규칙 목록 텍스트: `text-dim text-sm`, 값·경로는 `font-mono`. 규칙 error → `text-rose-300`, warn → `text-amber-300`, 위반 없음 → `text-emerald-300`.
- "실행 명령 미정의" 폴백: `text-faint text-sm`.
(`RunControls` 컴포넌트는 Task 4에서 스타일됨 — 여기선 그대로 사용.)

- [ ] **Step 2: NewProjectDialog.tsx 리스타일 (로직 불변)**

`components/NewProjectDialog.tsx`의 JSX className만 교체(useState·fetch·검증·router 유지):
- 트리거 버튼("+ 새 프로젝트"): `accent-gradient rounded-lg px-3 py-1.5 text-sm font-medium text-white transition hover:brightness-110`.
- 백드롭: `fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm`.
- 모달 카드: `glass glass-strong w-full max-w-md rounded-2xl p-6`.
- 제목: `text-lg font-semibold text-white`.
- 라벨 텍스트: `text-dim text-sm`.
- 인풋/셀렉트: `mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-white placeholder-white/30 focus:border-fuchsia-400/50 focus:outline-none`.
- 이름 규칙 위반 문구: `text-rose-300 text-xs`.
- 생성 위치 미리보기: `text-faint text-xs`, `<code>`는 `font-mono text-dim`.
- 에러: `text-rose-300 text-sm`.
- 취소 버튼: `rounded-lg px-3 py-1.5 text-sm text-dim hover:text-white`.
- 생성 버튼: `accent-gradient rounded-lg px-3 py-1.5 text-sm text-white disabled:opacity-40`.

- [ ] **Step 3: 빌드·테스트·시각 확인**

Run: `npm test` → 87 pass.
Run: `npm run build` → 성공.
gstack로 상세 뷰 + "+ 새 프로젝트" 모달(클릭해 열기만, **생성 제출 금지**) 스크린샷 — 글래스 모달·인풋 가독·백드롭 블러 확인. dev 종료.

- [ ] **Step 4: Commit**

```bash
git add "app/project/[name]/page.tsx" components/NewProjectDialog.tsx
git commit -m "style: 상세 뷰·새 프로젝트 모달 글래스화

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (계획 검토)

**Spec coverage:**
- 그라데이션 캔버스·글래스 유틸·팔레트·폰트 수정: Task 1 ✓
- 헤더/요약/섹션: Task 2 ✓
- 카드·상태·스택: Task 3 ✓
- OrcaPanel·RunControls: Task 4 ✓
- 상세 뷰·모달: Task 5 ✓
- 순수 비주얼·테스트 무영향: 전 태스크 "로직 불변" 명시 + 각 태스크 `npm test` 회귀 확인 ✓
- 접근성/대비: 본문 흰색·보조 dim/faint, ring·글로우로 상태 구분, 흰 아이콘 CDN ✓

**Placeholder scan:** Task 1·2·3은 완전한 교체 코드. Task 4·5는 "className만 교체 + 정확한 클래스 문자열 목록"을 제시하고 "로직 한 글자도 변경 금지"를 반복 — CSS 리스타일 특성상 파일 전체 재현 대신 정확한 클래스 매핑을 제공(각 요소별 최종 className 명시). 구현자는 파일을 읽어 해당 요소에 적용.

**Type consistency:** 새 타입 없음. 유틸 클래스명(`.glass`/`.glass-hover`/`.accent-gradient`/`.accent-text`/`.progress-track`/`.progress-fill`/`.text-dim`/`.text-faint`)이 Task 1 정의와 Task 2~5 사용에서 동일. props/함수 시그니처 불변.

**리스크:** backdrop-blur 다수 → 배경 블롭은 정적으로 유지(성능). simpleicons `/ffffff` 접미사로 흰 아이콘(일부 아이콘은 색 지정 시 렌더 확인 필요 — gstack로 검증). 로직 무변경이라 87 테스트는 전부 그대로 통과해야 함(하나라도 깨지면 마크업이 로직을 건드린 것 → 되돌릴 것).
