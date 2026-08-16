# 프로젝트 대시보드 (A+B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로컬 맥의 `~/Desktop/Projects`·`~/Desktop/Career` 하위 프로젝트를 읽기 전용으로 스캔해, 기술스택·진행도·설명·git 상태·워크플로우 규칙 위반을 가독성 좋은 웹 대시보드로 보여준다.

**Architecture:** Next.js(App Router) 단일 앱. 순수 TS 스캐너 모듈(`lib/scanner/*`)이 파일시스템을 읽기만 하여 `ProjectInfo[]`를 만들고, API Route가 이를 JSON으로 노출하며, App Router 페이지가 카드 그리드와 상세 뷰를 렌더한다. 스캐너는 파일시스템에 절대 쓰지 않는다.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Vitest(스캐너 단위/통합 테스트, node 환경).

## Global Constraints

- Node 20.20.2 / npm 10.8.2 환경. Next.js 15, React 19.
- 스캐너는 **읽기 전용**. 파일시스템 쓰기 금지(web.md의 read-only 원칙). DB 없음.
- TDD: 스캐너 각 모듈은 실패하는 테스트를 먼저 쓴다(web.md).
- 진행도(`progress`)는 매니페스트에만 의존. 없으면 `null` → UI에서 `—`. **가짜 숫자를 만들지 않는다.**
- 스캔 루트 기본값: `~/Desktop/Projects`(category `project`), `~/Desktop/Career`(category `career`). 각 루트의 1단계 하위 디렉터리가 프로젝트 단위. 파일·숨김폴더(`.`으로 시작) 제외.
- 커밋 메시지 말미에 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` 추가.
- 배포·머지 등 되돌리기 어려운 명령은 사람 확인 후. 이 계획에는 그런 단계 없음.

---

## Task 1: Next.js + Vitest 스캐폴딩

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `tailwind.config.ts`, `postcss.config.mjs`, `.gitignore`
- Test: `lib/scanner/__tests__/smoke.test.ts`

**Interfaces:**
- Produces: 동작하는 Next.js dev 서버(`npm run dev`)와 통과하는 Vitest 러너(`npm test`).

- [ ] **Step 1: create-next-app으로 스캐폴딩**

Run:
```bash
cd /Users/kimhands/Desktop/Projects/project-platform
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*" --use-npm --eslint --yes
```
기존 `AGENTS.md`/`CLAUDE.md`/`docs`는 유지된다(create-next-app은 비어있지 않은 디렉터리에 파일을 추가). 충돌 프롬프트가 나오면 기존 파일 덮어쓰기 거부.

- [ ] **Step 2: Vitest 설치**

Run:
```bash
npm install -D vitest
```

- [ ] **Step 3: vitest.config.ts 작성**

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: { environment: 'node', include: ['lib/**/*.test.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
})
```

- [ ] **Step 4: package.json에 test 스크립트 추가**

`package.json`의 `scripts`에 추가:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: 스모크 테스트 작성 (실패 확인용)**

`lib/scanner/__tests__/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest'

describe('smoke', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 6: 테스트·빌드 확인**

Run: `npm test`
Expected: PASS (1 test)

Run: `npm run build`
Expected: 빌드 성공.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: Next.js + Vitest 스캐폴딩

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: 타입 정의 + config

**Files:**
- Create: `lib/scanner/types.ts`, `config.ts`
- Test: `lib/scanner/config.test.ts`

**Interfaces:**
- Produces:
  - `types.ts` — `Category`, `Status`, `StackItem`, `RunConfig`, `Manifest`, `GitInfo`, `RuleViolation`, `ProjectInfo` 타입.
  - `config.ts` — `interface Root { path: string; category: Category }`, `export const ROOTS: Root[]`.

- [ ] **Step 1: types.ts 작성**

`lib/scanner/types.ts`:
```ts
export type Category = 'project' | 'career'
export type Status = 'planning' | 'active' | 'paused' | 'done'

export interface StackItem { id: string; label: string; icon: string }
export interface RunConfig { cmd: string; port?: number }

export interface Manifest {
  description?: string
  status?: Status
  progress?: number
  run?: RunConfig
  stack?: string[]
  tags?: string[]
}

export interface GitInfo {
  branch: string
  lastCommit: string // 상대시간 문자열 (예: "3 days ago")
  dirty: boolean
  commitCount: number
}

export interface RuleViolation {
  id: string
  level: 'error' | 'warn'
  message: string
}

export interface ProjectInfo {
  path: string
  folderName: string
  name: string
  category: Category
  description: string
  status: Status
  progress: number | null
  stack: StackItem[]
  runnable: boolean
  git: GitInfo | null
  rules: RuleViolation[]
  hasManifest: boolean
  tags: string[]
}
```

- [ ] **Step 2: config 테스트 작성 (실패 확인)**

`lib/scanner/config.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import { ROOTS } from '@/config'

describe('ROOTS', () => {
  it('Projects와 Career 두 루트를 홈 기준으로 정의한다', () => {
    const home = os.homedir()
    expect(ROOTS).toEqual([
      { path: path.join(home, 'Desktop/Projects'), category: 'project' },
      { path: path.join(home, 'Desktop/Career'), category: 'career' },
    ])
  })
})
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npx vitest run lib/scanner/config.test.ts`
Expected: FAIL — `@/config` 모듈 없음.

- [ ] **Step 4: config.ts 작성**

`config.ts`:
```ts
import os from 'node:os'
import path from 'node:path'
import type { Category } from '@/lib/scanner/types'

export interface Root { path: string; category: Category }

export const ROOTS: Root[] = [
  { path: path.join(os.homedir(), 'Desktop/Projects'), category: 'project' },
  { path: path.join(os.homedir(), 'Desktop/Career'), category: 'career' },
]
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run lib/scanner/config.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/scanner/types.ts config.ts lib/scanner/config.test.ts
git commit -m "feat: 스캐너 타입 정의와 스캔 루트 config

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: detectStack — 기술스택 자동 감지

**Files:**
- Create: `lib/scanner/detectStack.ts`
- Test: `lib/scanner/detectStack.test.ts`

**Interfaces:**
- Consumes: `StackItem` from `types.ts`.
- Produces: `export async function detectStack(dir: string): Promise<StackItem[]>` — 디렉터리의 마커 파일을 읽어 스택 목록 반환. `export const STACK_REGISTRY: Record<string, StackItem>` (id → label/icon).

- [ ] **Step 1: 테스트 작성 (실패 확인)**

`lib/scanner/detectStack.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { detectStack } from './detectStack'

let dir: string
beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ds-')) })
afterEach(async () => { await fs.rm(dir, { recursive: true, force: true }) })

const ids = (items: { id: string }[]) => items.map((i) => i.id).sort()

describe('detectStack', () => {
  it('마커가 없으면 빈 배열', async () => {
    expect(await detectStack(dir)).toEqual([])
  })

  it('package.json + next 의존성이면 node와 next를 감지', async () => {
    await fs.writeFile(
      path.join(dir, 'package.json'),
      JSON.stringify({ dependencies: { next: '15.0.0', react: '19.0.0' } }),
    )
    expect(ids(await detectStack(dir))).toEqual(['next', 'node', 'react'])
  })

  it('requirements.txt면 python', async () => {
    await fs.writeFile(path.join(dir, 'requirements.txt'), 'flask\n')
    expect(ids(await detectStack(dir))).toEqual(['python'])
  })

  it('go.mod면 go', async () => {
    await fs.writeFile(path.join(dir, 'go.mod'), 'module x\n')
    expect(ids(await detectStack(dir))).toEqual(['go'])
  })

  it('Dockerfile은 다른 스택에 추가로 감지', async () => {
    await fs.writeFile(path.join(dir, 'go.mod'), 'module x\n')
    await fs.writeFile(path.join(dir, 'Dockerfile'), 'FROM alpine\n')
    expect(ids(await detectStack(dir))).toEqual(['docker', 'go'])
  })

  it('아무 마커 없이 index.html만 있으면 static', async () => {
    await fs.writeFile(path.join(dir, 'index.html'), '<html></html>')
    expect(ids(await detectStack(dir))).toEqual(['static'])
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run lib/scanner/detectStack.test.ts`
Expected: FAIL — `detectStack` 없음.

- [ ] **Step 3: detectStack.ts 구현**

`lib/scanner/detectStack.ts`:
```ts
import fs from 'node:fs/promises'
import path from 'node:path'
import type { StackItem } from './types'

export const STACK_REGISTRY: Record<string, StackItem> = {
  node: { id: 'node', label: 'Node.js', icon: 'nodedotjs' },
  next: { id: 'next', label: 'Next.js', icon: 'nextdotjs' },
  react: { id: 'react', label: 'React', icon: 'react' },
  vue: { id: 'vue', label: 'Vue', icon: 'vuedotjs' },
  express: { id: 'express', label: 'Express', icon: 'express' },
  python: { id: 'python', label: 'Python', icon: 'python' },
  go: { id: 'go', label: 'Go', icon: 'go' },
  rust: { id: 'rust', label: 'Rust', icon: 'rust' },
  java: { id: 'java', label: 'Java', icon: 'openjdk' },
  docker: { id: 'docker', label: 'Docker', icon: 'docker' },
  static: { id: 'static', label: 'Static Web', icon: 'html5' },
}

async function exists(p: string): Promise<boolean> {
  try { await fs.access(p); return true } catch { return false }
}

async function readJson(p: string): Promise<Record<string, unknown> | null> {
  try { return JSON.parse(await fs.readFile(p, 'utf8')) } catch { return null }
}

export async function detectStack(dir: string): Promise<StackItem[]> {
  const found = new Set<string>()

  const pkgPath = path.join(dir, 'package.json')
  if (await exists(pkgPath)) {
    found.add('node')
    const pkg = await readJson(pkgPath)
    const deps = {
      ...(pkg?.dependencies as object),
      ...(pkg?.devDependencies as object),
    } as Record<string, string>
    if (deps.next) found.add('next')
    if (deps.react) found.add('react')
    if (deps.vue) found.add('vue')
    if (deps.express) found.add('express')
  }

  if ((await exists(path.join(dir, 'requirements.txt'))) ||
      (await exists(path.join(dir, 'pyproject.toml')))) found.add('python')
  if (await exists(path.join(dir, 'go.mod'))) found.add('go')
  if (await exists(path.join(dir, 'Cargo.toml'))) found.add('rust')
  if ((await exists(path.join(dir, 'pom.xml'))) ||
      (await exists(path.join(dir, 'build.gradle')))) found.add('java')
  if (await exists(path.join(dir, 'Dockerfile'))) found.add('docker')

  if (found.size === 0 && (await exists(path.join(dir, 'index.html')))) {
    found.add('static')
  }

  return [...found].map((id) => STACK_REGISTRY[id])
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run lib/scanner/detectStack.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/scanner/detectStack.ts lib/scanner/detectStack.test.ts
git commit -m "feat: 마커 파일 기반 기술스택 자동 감지

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: parseManifest — project.json 파싱·검증

**Files:**
- Create: `lib/scanner/parseManifest.ts`
- Test: `lib/scanner/parseManifest.test.ts`

**Interfaces:**
- Consumes: `Manifest`, `Status` from `types.ts`.
- Produces: `export async function parseManifest(dir: string): Promise<{ manifest: Manifest | null; invalid: boolean }>`.
  - 파일 없음 → `{ manifest: null, invalid: false }`
  - JSON 파싱 실패 또는 스키마 위반 → `{ manifest: null, invalid: true }`
  - 정상 → `{ manifest, invalid: false }`

- [ ] **Step 1: 테스트 작성 (실패 확인)**

`lib/scanner/parseManifest.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { parseManifest } from './parseManifest'

let dir: string
beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pm-')) })
afterEach(async () => { await fs.rm(dir, { recursive: true, force: true }) })
const write = (obj: unknown) =>
  fs.writeFile(path.join(dir, 'project.json'),
    typeof obj === 'string' ? obj : JSON.stringify(obj))

describe('parseManifest', () => {
  it('파일 없으면 manifest null, invalid false', async () => {
    expect(await parseManifest(dir)).toEqual({ manifest: null, invalid: false })
  })

  it('정상 매니페스트를 파싱', async () => {
    await write({ description: 'x', status: 'active', progress: 60 })
    const r = await parseManifest(dir)
    expect(r.invalid).toBe(false)
    expect(r.manifest).toMatchObject({ description: 'x', status: 'active', progress: 60 })
  })

  it('깨진 JSON은 invalid true', async () => {
    await write('{ not json')
    expect(await parseManifest(dir)).toEqual({ manifest: null, invalid: true })
  })

  it('status가 허용값 밖이면 invalid true', async () => {
    await write({ status: 'wip' })
    expect(await parseManifest(dir)).toEqual({ manifest: null, invalid: true })
  })

  it('progress가 0~100 밖이면 invalid true', async () => {
    await write({ progress: 150 })
    expect(await parseManifest(dir)).toEqual({ manifest: null, invalid: true })
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run lib/scanner/parseManifest.test.ts`
Expected: FAIL — `parseManifest` 없음.

- [ ] **Step 3: parseManifest.ts 구현**

`lib/scanner/parseManifest.ts`:
```ts
import fs from 'node:fs/promises'
import path from 'node:path'
import type { Manifest, Status } from './types'

const STATUSES: Status[] = ['planning', 'active', 'paused', 'done']

function validate(raw: unknown): Manifest | null {
  if (typeof raw !== 'object' || raw === null) return null
  const o = raw as Record<string, unknown>
  if (o.status !== undefined && !STATUSES.includes(o.status as Status)) return null
  if (o.progress !== undefined) {
    if (typeof o.progress !== 'number' || o.progress < 0 || o.progress > 100) return null
  }
  if (o.description !== undefined && typeof o.description !== 'string') return null
  if (o.stack !== undefined && !Array.isArray(o.stack)) return null
  if (o.tags !== undefined && !Array.isArray(o.tags)) return null
  if (o.run !== undefined) {
    const run = o.run as Record<string, unknown>
    if (typeof run?.cmd !== 'string') return null
  }
  return o as Manifest
}

export async function parseManifest(
  dir: string,
): Promise<{ manifest: Manifest | null; invalid: boolean }> {
  const p = path.join(dir, 'project.json')
  let text: string
  try {
    text = await fs.readFile(p, 'utf8')
  } catch {
    return { manifest: null, invalid: false }
  }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { manifest: null, invalid: true }
  }
  const manifest = validate(raw)
  if (manifest === null) return { manifest: null, invalid: true }
  return { manifest, invalid: false }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run lib/scanner/parseManifest.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/scanner/parseManifest.ts lib/scanner/parseManifest.test.ts
git commit -m "feat: project.json 매니페스트 파싱·검증

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: readGit — git 정보 읽기 전용

**Files:**
- Create: `lib/scanner/readGit.ts`
- Test: `lib/scanner/readGit.test.ts`

**Interfaces:**
- Consumes: `GitInfo` from `types.ts`.
- Produces: `export async function readGit(dir: string): Promise<GitInfo | null>` — `.git` 없으면 `null`. git 명령은 읽기 전용만 사용.

- [ ] **Step 1: 테스트 작성 (실패 확인)**

`lib/scanner/readGit.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { readGit } from './readGit'

let dir: string
beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rg-')) })
afterEach(async () => { await fs.rm(dir, { recursive: true, force: true }) })

describe('readGit', () => {
  it('git 저장소가 아니면 null', async () => {
    expect(await readGit(dir)).toBeNull()
  })

  it('커밋이 있는 저장소의 정보를 읽는다', async () => {
    const git = (...args: string[]) =>
      execFileSync('git', args, { cwd: dir, stdio: 'pipe' })
    git('init', '-b', 'main')
    git('config', 'user.email', 't@t.com')
    git('config', 'user.name', 'T')
    await fs.writeFile(path.join(dir, 'a.txt'), 'hi')
    git('add', '.')
    git('commit', '-m', 'first')

    const info = await readGit(dir)
    expect(info).not.toBeNull()
    expect(info!.branch).toBe('main')
    expect(info!.commitCount).toBe(1)
    expect(info!.dirty).toBe(false)
    expect(typeof info!.lastCommit).toBe('string')
  })

  it('커밋 안 된 변경이 있으면 dirty true', async () => {
    const git = (...args: string[]) =>
      execFileSync('git', args, { cwd: dir, stdio: 'pipe' })
    git('init', '-b', 'main')
    git('config', 'user.email', 't@t.com')
    git('config', 'user.name', 'T')
    await fs.writeFile(path.join(dir, 'a.txt'), 'hi')
    git('add', '.')
    git('commit', '-m', 'first')
    await fs.writeFile(path.join(dir, 'a.txt'), 'changed')

    const info = await readGit(dir)
    expect(info!.dirty).toBe(true)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run lib/scanner/readGit.test.ts`
Expected: FAIL — `readGit` 없음.

- [ ] **Step 3: readGit.ts 구현**

`lib/scanner/readGit.ts`:
```ts
import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { GitInfo } from './types'

const run = promisify(execFile)

async function git(dir: string, args: string[]): Promise<string> {
  const { stdout } = await run('git', args, { cwd: dir })
  return stdout.trim()
}

export async function readGit(dir: string): Promise<GitInfo | null> {
  try {
    await fs.access(path.join(dir, '.git'))
  } catch {
    return null
  }
  try {
    const branch = await git(dir, ['rev-parse', '--abbrev-ref', 'HEAD'])
    const lastCommit = await git(dir, ['log', '-1', '--format=%cr'])
    const countStr = await git(dir, ['rev-list', '--count', 'HEAD'])
    const status = await git(dir, ['status', '--porcelain'])
    return {
      branch,
      lastCommit,
      commitCount: parseInt(countStr, 10) || 0,
      dirty: status.length > 0,
    }
  } catch {
    return null
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run lib/scanner/readGit.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/scanner/readGit.ts lib/scanner/readGit.test.ts
git commit -m "feat: git 정보 읽기 전용 수집

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: checkRules — 워크플로우 규칙 검사

**Files:**
- Create: `lib/scanner/checkRules.ts`
- Test: `lib/scanner/checkRules.test.ts`

**Interfaces:**
- Consumes: `RuleViolation` from `types.ts`.
- Produces: `export async function checkRules(dir: string, folderName: string, manifestInvalid: boolean): Promise<RuleViolation[]>`.

- [ ] **Step 1: 테스트 작성 (실패 확인)**

`lib/scanner/checkRules.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { checkRules } from './checkRules'

let dir: string
beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cr-')) })
afterEach(async () => { await fs.rm(dir, { recursive: true, force: true }) })
const ids = (rs: { id: string }[]) => rs.map((r) => r.id).sort()

describe('checkRules', () => {
  it('규칙에 맞는 폴더는 위반 없음', async () => {
    await fs.writeFile(path.join(dir, 'CLAUDE.md'), '@AGENTS.md\n')
    await fs.writeFile(path.join(dir, 'AGENTS.md'), '# x\n')
    const rules = await checkRules(dir, 'my-project', false)
    expect(rules).toEqual([])
  })

  it('폴더명에 대문자/한글이 있으면 folder-name-format error', async () => {
    await fs.writeFile(path.join(dir, 'CLAUDE.md'), '@AGENTS.md\n')
    await fs.writeFile(path.join(dir, 'AGENTS.md'), '# x\n')
    const rules = await checkRules(dir, 'My_프로젝트', false)
    const r = rules.find((x) => x.id === 'folder-name-format')
    expect(r?.level).toBe('error')
  })

  it('CLAUDE.md 없으면 claudemd-exists warn', async () => {
    await fs.writeFile(path.join(dir, 'AGENTS.md'), '# x\n')
    expect(ids(await checkRules(dir, 'ok', false))).toContain('claudemd-exists')
  })

  it('CLAUDE.md 첫 줄이 @AGENTS.md 아니면 claudemd-first-line warn', async () => {
    await fs.writeFile(path.join(dir, 'CLAUDE.md'), '# hello\n')
    await fs.writeFile(path.join(dir, 'AGENTS.md'), '# x\n')
    expect(ids(await checkRules(dir, 'ok', false))).toContain('claudemd-first-line')
  })

  it('AGENTS.md 없으면 agentsmd-exists warn', async () => {
    await fs.writeFile(path.join(dir, 'CLAUDE.md'), '@AGENTS.md\n')
    expect(ids(await checkRules(dir, 'ok', false))).toContain('agentsmd-exists')
  })

  it('manifestInvalid면 manifest-invalid warn', async () => {
    await fs.writeFile(path.join(dir, 'CLAUDE.md'), '@AGENTS.md\n')
    await fs.writeFile(path.join(dir, 'AGENTS.md'), '# x\n')
    expect(ids(await checkRules(dir, 'ok', true))).toContain('manifest-invalid')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run lib/scanner/checkRules.test.ts`
Expected: FAIL — `checkRules` 없음.

- [ ] **Step 3: checkRules.ts 구현**

`lib/scanner/checkRules.ts`:
```ts
import fs from 'node:fs/promises'
import path from 'node:path'
import type { RuleViolation } from './types'

const FOLDER_RE = /^[a-z0-9-]+$/

async function readFileOrNull(p: string): Promise<string | null> {
  try { return await fs.readFile(p, 'utf8') } catch { return null }
}

export async function checkRules(
  dir: string,
  folderName: string,
  manifestInvalid: boolean,
): Promise<RuleViolation[]> {
  const rules: RuleViolation[] = []

  if (!FOLDER_RE.test(folderName)) {
    rules.push({
      id: 'folder-name-format',
      level: 'error',
      message: '폴더명은 ASCII 소문자·숫자·하이픈만 허용됩니다.',
    })
  }

  const claude = await readFileOrNull(path.join(dir, 'CLAUDE.md'))
  if (claude === null) {
    rules.push({
      id: 'claudemd-exists',
      level: 'warn',
      message: 'CLAUDE.md가 없어 프로젝트 규칙이 주입되지 않습니다.',
    })
  } else if (claude.split('\n')[0].trim() !== '@AGENTS.md') {
    rules.push({
      id: 'claudemd-first-line',
      level: 'warn',
      message: 'CLAUDE.md 첫 줄은 @AGENTS.md 여야 합니다.',
    })
  }

  const agents = await readFileOrNull(path.join(dir, 'AGENTS.md'))
  if (agents === null) {
    rules.push({
      id: 'agentsmd-exists',
      level: 'warn',
      message: 'AGENTS.md가 없습니다.',
    })
  }

  if (manifestInvalid) {
    rules.push({
      id: 'manifest-invalid',
      level: 'warn',
      message: 'project.json이 손상되었거나 스키마에 맞지 않습니다.',
    })
  }

  return rules
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run lib/scanner/checkRules.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/scanner/checkRules.ts lib/scanner/checkRules.test.ts
git commit -m "feat: 워크플로우 규칙 위반 검사

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: scanProjects — 조립 + 통합

**Files:**
- Create: `lib/scanner/buildProjectInfo.ts`, `lib/scanner/scanProjects.ts`
- Test: `lib/scanner/buildProjectInfo.test.ts`

**Interfaces:**
- Consumes: `detectStack`, `parseManifest`, `readGit`, `checkRules`, `STACK_REGISTRY`, `ROOTS`, 모든 `types`.
- Produces:
  - `export async function buildProjectInfo(dir: string, category: Category): Promise<ProjectInfo>` — 한 프로젝트 폴더 → ProjectInfo.
  - `export async function scanProjects(roots?: Root[]): Promise<ProjectInfo[]>` — 루트들을 순회. 기본값 `ROOTS`.

- [ ] **Step 1: buildProjectInfo 테스트 작성 (실패 확인)**

`lib/scanner/buildProjectInfo.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { buildProjectInfo, scanProjects } from './scanProjects'

let root: string
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'sp-')) })
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }) })

describe('buildProjectInfo', () => {
  it('매니페스트가 있으면 설명·진행도·상태를 채운다', async () => {
    const dir = path.join(root, 'demo-app')
    await fs.mkdir(dir)
    await fs.writeFile(path.join(dir, 'package.json'),
      JSON.stringify({ dependencies: { next: '15' } }))
    await fs.writeFile(path.join(dir, 'project.json'),
      JSON.stringify({ description: '데모', status: 'active', progress: 40,
        run: { cmd: 'npm run dev' } }))

    const info = await buildProjectInfo(dir, 'project')
    expect(info.folderName).toBe('demo-app')
    expect(info.description).toBe('데모')
    expect(info.progress).toBe(40)
    expect(info.status).toBe('active')
    expect(info.runnable).toBe(true)
    expect(info.hasManifest).toBe(true)
    expect(info.stack.map((s) => s.id).sort()).toEqual(['next', 'node'])
  })

  it('매니페스트가 없으면 progress null, planning, hasManifest false', async () => {
    const dir = path.join(root, 'bare')
    await fs.mkdir(dir)
    const info = await buildProjectInfo(dir, 'career')
    expect(info.progress).toBeNull()
    expect(info.status).toBe('planning')
    expect(info.hasManifest).toBe(false)
    expect(info.runnable).toBe(false)
    expect(info.name).toBe('bare')
  })

  it('매니페스트 stack을 감지 결과와 병합·중복제거', async () => {
    const dir = path.join(root, 'merge')
    await fs.mkdir(dir)
    await fs.writeFile(path.join(dir, 'package.json'),
      JSON.stringify({ dependencies: { next: '15' } }))
    await fs.writeFile(path.join(dir, 'project.json'),
      JSON.stringify({ stack: ['next', 'docker'] }))
    const info = await buildProjectInfo(dir, 'project')
    expect(info.stack.map((s) => s.id).sort()).toEqual(['docker', 'next', 'node'])
  })
})

describe('scanProjects', () => {
  it('루트 하위 디렉터리만 프로젝트로, 숨김·파일 제외', async () => {
    await fs.mkdir(path.join(root, 'proj-a'))
    await fs.mkdir(path.join(root, '.hidden'))
    await fs.writeFile(path.join(root, '.DS_Store'), 'x')
    const infos = await scanProjects([{ path: root, category: 'project' }])
    expect(infos.map((i) => i.folderName)).toEqual(['proj-a'])
  })

  it('존재하지 않는 루트는 건너뛴다', async () => {
    const infos = await scanProjects([
      { path: path.join(root, 'nope'), category: 'project' },
    ])
    expect(infos).toEqual([])
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run lib/scanner/buildProjectInfo.test.ts`
Expected: FAIL — `scanProjects` 모듈 없음.

- [ ] **Step 3: buildProjectInfo.ts 구현**

`lib/scanner/buildProjectInfo.ts`:
```ts
import path from 'node:path'
import type { Category, ProjectInfo, StackItem, Status } from './types'
import { detectStack, STACK_REGISTRY } from './detectStack'
import { parseManifest } from './parseManifest'
import { readGit } from './readGit'
import { checkRules } from './checkRules'

function mergeStack(detected: StackItem[], manifestIds?: string[]): StackItem[] {
  const map = new Map<string, StackItem>()
  for (const s of detected) map.set(s.id, s)
  for (const id of manifestIds ?? []) {
    if (!map.has(id)) {
      map.set(id, STACK_REGISTRY[id] ?? { id, label: id, icon: 'dot' })
    }
  }
  return [...map.values()]
}

function deriveStatus(explicit: Status | undefined, git: { lastCommit: string } | null): Status {
  if (explicit) return explicit
  if (!git) return 'planning'
  return /year|month/.test(git.lastCommit) ? 'paused' : 'active'
}

export async function buildProjectInfo(
  dir: string,
  category: Category,
): Promise<ProjectInfo> {
  const folderName = path.basename(dir)
  const [detected, { manifest, invalid }, git] = await Promise.all([
    detectStack(dir),
    parseManifest(dir),
    readGit(dir),
  ])
  const rules = await checkRules(dir, folderName, invalid)

  return {
    path: dir,
    folderName,
    name: folderName,
    category,
    description: manifest?.description ?? '',
    status: deriveStatus(manifest?.status, git),
    progress: manifest?.progress ?? null,
    stack: mergeStack(detected, manifest?.stack),
    runnable: Boolean(manifest?.run?.cmd),
    git,
    rules,
    hasManifest: manifest !== null,
    tags: manifest?.tags ?? [],
  }
}
```

- [ ] **Step 4: scanProjects.ts 구현**

`lib/scanner/scanProjects.ts`:
```ts
import fs from 'node:fs/promises'
import path from 'node:path'
import type { ProjectInfo } from './types'
import { ROOTS, type Root } from '@/config'
import { buildProjectInfo } from './buildProjectInfo'

export { buildProjectInfo }

export async function scanProjects(roots: Root[] = ROOTS): Promise<ProjectInfo[]> {
  const all: ProjectInfo[] = []
  for (const root of roots) {
    let entries
    try {
      entries = await fs.readdir(root.path, { withFileTypes: true })
    } catch {
      continue
    }
    const dirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    const infos = await Promise.all(
      dirs.map((e) => buildProjectInfo(path.join(root.path, e.name), root.category)),
    )
    all.push(...infos)
  }
  return all
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run lib/scanner/buildProjectInfo.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: 전체 스캐너 테스트 확인**

Run: `npm test`
Expected: 모든 스캐너 테스트 PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/scanner/buildProjectInfo.ts lib/scanner/scanProjects.ts lib/scanner/buildProjectInfo.test.ts
git commit -m "feat: 프로젝트 정보 조립과 루트 스캔

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: API Route

**Files:**
- Create: `app/api/projects/route.ts`

**Interfaces:**
- Consumes: `scanProjects` from `@/lib/scanner/scanProjects`.
- Produces: `GET /api/projects` → `{ projects: ProjectInfo[] }` JSON. `export const dynamic = 'force-dynamic'`(캐시 방지, 매 요청 스캔).

- [ ] **Step 1: route.ts 작성**

`app/api/projects/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { scanProjects } from '@/lib/scanner/scanProjects'

export const dynamic = 'force-dynamic'

export async function GET() {
  const projects = await scanProjects()
  return NextResponse.json({ projects })
}
```

- [ ] **Step 2: 수동 확인**

Run: `npm run dev` (백그라운드) 후
```bash
curl -s http://localhost:3000/api/projects | head -c 400
```
Expected: `{"projects":[...]}` 형태 JSON. 실제 로컬 프로젝트 폴더명이 보임.

- [ ] **Step 3: Commit**

```bash
git add app/api/projects/route.ts
git commit -m "feat: /api/projects 스캔 결과 JSON 노출

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: 대시보드 UI — 카드 그리드

**Files:**
- Modify: `app/page.tsx`, `app/globals.css`(필요 시)
- Create: `components/ProjectCard.tsx`, `components/StatusBadge.tsx`, `components/StackIcons.tsx`, `lib/ui/format.ts`

**Interfaces:**
- Consumes: `ProjectInfo`, `StackItem` 타입. 서버 컴포넌트에서 `scanProjects()` 직접 호출(같은 프로세스이므로 fetch 불필요).
- Produces: 카테고리별(Projects/Career) 카드 그리드. 각 카드: 이름·상태 배지·진행도 바·스택 아이콘·git 신선도·규칙 경고 배지·매니페스트 없음 표시. 상단 "규칙 위반 N개" 요약.

- [ ] **Step 1: StatusBadge 컴포넌트**

`components/StatusBadge.tsx`:
```tsx
import type { Status } from '@/lib/scanner/types'

const STYLE: Record<Status, string> = {
  planning: 'bg-slate-200 text-slate-700',
  active: 'bg-green-200 text-green-800',
  paused: 'bg-yellow-200 text-yellow-800',
  done: 'bg-blue-200 text-blue-800',
}
const LABEL: Record<Status, string> = {
  planning: '기획', active: '진행중', paused: '중단', done: '완료',
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STYLE[status]}`}>
      {LABEL[status]}
    </span>
  )
}
```

- [ ] **Step 2: StackIcons 컴포넌트 (simple-icons CDN 사용)**

`components/StackIcons.tsx`:
```tsx
import type { StackItem } from '@/lib/scanner/types'

export function StackIcons({ stack }: { stack: StackItem[] }) {
  if (stack.length === 0) return <span className="text-xs text-slate-400">스택 미상</span>
  return (
    <div className="flex flex-wrap gap-1.5">
      {stack.map((s) => (
        <span key={s.id} title={s.label}
          className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs">
          <img alt={s.label} width={12} height={12}
            src={`https://cdn.simpleicons.org/${s.icon}`} />
          {s.label}
        </span>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: format 유틸**

`lib/ui/format.ts`:
```ts
import type { RuleViolation } from '@/lib/scanner/types'

export function countErrors(rules: RuleViolation[]): number {
  return rules.filter((r) => r.level === 'error').length
}
export function countWarns(rules: RuleViolation[]): number {
  return rules.filter((r) => r.level === 'warn').length
}
```

- [ ] **Step 4: ProjectCard 컴포넌트**

`components/ProjectCard.tsx`:
```tsx
import Link from 'next/link'
import type { ProjectInfo } from '@/lib/scanner/types'
import { StatusBadge } from './StatusBadge'
import { StackIcons } from './StackIcons'
import { countErrors, countWarns } from '@/lib/ui/format'

export function ProjectCard({ p }: { p: ProjectInfo }) {
  const errors = countErrors(p.rules)
  const warns = countWarns(p.rules)
  return (
    <Link href={`/project/${p.folderName}`}
      className={`block rounded-xl border p-4 transition hover:shadow-md ${
        p.hasManifest ? 'bg-white' : 'bg-slate-50 opacity-80'}`}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">{p.name}</h3>
        <StatusBadge status={p.status} />
      </div>
      {p.description && <p className="mb-2 line-clamp-2 text-sm text-slate-600">{p.description}</p>}
      <div className="mb-3">
        {p.progress === null ? (
          <span className="text-xs text-slate-400">진행도 —</span>
        ) : (
          <div className="h-2 w-full rounded-full bg-slate-200">
            <div className="h-2 rounded-full bg-green-500" style={{ width: `${p.progress}%` }} />
          </div>
        )}
      </div>
      <StackIcons stack={p.stack} />
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>{p.git ? `${p.git.branch} · ${p.git.lastCommit}` : 'git 없음'}</span>
        <span className="flex gap-1">
          {errors > 0 && <span className="rounded bg-red-100 px-1.5 text-red-700">위반 {errors}</span>}
          {warns > 0 && <span className="rounded bg-amber-100 px-1.5 text-amber-700">경고 {warns}</span>}
        </span>
      </div>
    </Link>
  )
}
```

- [ ] **Step 5: page.tsx (서버 컴포넌트)**

`app/page.tsx`:
```tsx
import { scanProjects } from '@/lib/scanner/scanProjects'
import { ProjectCard } from '@/components/ProjectCard'
import { countErrors, countWarns } from '@/lib/ui/format'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const projects = await scanProjects()
  const totalErrors = projects.reduce((n, p) => n + countErrors(p.rules), 0)
  const totalWarns = projects.reduce((n, p) => n + countWarns(p.rules), 0)
  const groups: Array<['project' | 'career', string]> = [
    ['project', 'Projects'], ['career', 'Career'],
  ]
  return (
    <main className="mx-auto max-w-6xl p-8">
      <header className="mb-6 flex items-end justify-between">
        <h1 className="text-2xl font-bold">프로젝트 대시보드</h1>
        <div className="text-sm text-slate-600">
          규칙 위반 <b className="text-red-600">{totalErrors}</b> · 경고{' '}
          <b className="text-amber-600">{totalWarns}</b> · 총 {projects.length}개
        </div>
      </header>
      {groups.map(([cat, label]) => {
        const items = projects.filter((p) => p.category === cat)
        if (items.length === 0) return null
        return (
          <section key={cat} className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-slate-700">{label}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((p) => <ProjectCard key={p.path} p={p} />)}
            </div>
          </section>
        )
      })}
    </main>
  )
}
```

- [ ] **Step 6: 브라우저 확인 (gstack)**

web.md에 따라 브라우저 확인은 `gstack`을 명시 호출한다. `npm run dev` 후 gstack으로 `http://localhost:3000` 열어 카드 그리드·상태 배지·규칙 요약이 보이는지 스크린샷으로 확인.

- [ ] **Step 7: Commit**

```bash
git add app/page.tsx components/ProjectCard.tsx components/StatusBadge.tsx components/StackIcons.tsx lib/ui/format.ts
git commit -m "feat: 카드 그리드 대시보드 UI

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: 프로젝트 상세 뷰

**Files:**
- Create: `app/project/[name]/page.tsx`

**Interfaces:**
- Consumes: `scanProjects`, `ProjectInfo`. 라우트 파라미터 `name` = `folderName`.
- Produces: 전체 설명·스택·git·규칙 목록·실행 명령(표시만, 버튼 비활성 "곧") 상세 페이지. 없는 프로젝트는 `notFound()`.

- [ ] **Step 1: 상세 페이지 작성**

`app/project/[name]/page.tsx`:
```tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { scanProjects } from '@/lib/scanner/scanProjects'
import { StatusBadge } from '@/components/StatusBadge'
import { StackIcons } from '@/components/StackIcons'

export const dynamic = 'force-dynamic'

export default async function ProjectDetail(
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params
  const projects = await scanProjects()
  const p = projects.find((x) => x.folderName === decodeURIComponent(name))
  if (!p) notFound()

  return (
    <main className="mx-auto max-w-3xl p-8">
      <Link href="/" className="text-sm text-slate-500 hover:underline">← 대시보드</Link>
      <div className="mt-3 mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-bold">{p.name}</h1>
        <StatusBadge status={p.status} />
      </div>
      <p className="mb-4 text-sm text-slate-500">{p.path}</p>
      {p.description && <p className="mb-6">{p.description}</p>}

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">기술 스택</h2>
        <StackIcons stack={p.stack} />
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">진행도</h2>
        <p>{p.progress === null ? '— (매니페스트에 progress 없음)' : `${p.progress}%`}</p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">Git</h2>
        {p.git ? (
          <ul className="text-sm text-slate-700">
            <li>브랜치: {p.git.branch}</li>
            <li>최근 커밋: {p.git.lastCommit}</li>
            <li>커밋 수: {p.git.commitCount}</li>
            <li>변경사항: {p.git.dirty ? '있음(dirty)' : '없음'}</li>
          </ul>
        ) : <p className="text-sm text-slate-500">git 저장소 아님</p>}
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">실행</h2>
        {p.runnable ? (
          <button disabled
            className="cursor-not-allowed rounded bg-slate-200 px-3 py-1.5 text-sm text-slate-500">
            동작 (곧 지원)
          </button>
        ) : <p className="text-sm text-slate-500">실행 명령 미정의</p>}
      </section>

      <section>
        <h2 className="mb-2 font-semibold">규칙 검사</h2>
        {p.rules.length === 0 ? (
          <p className="text-sm text-green-700">위반 없음 ✓</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {p.rules.map((r) => (
              <li key={r.id}>
                <span className={r.level === 'error' ? 'text-red-600' : 'text-amber-600'}>
                  [{r.level}]
                </span>{' '}
                {r.message}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
```

- [ ] **Step 2: 브라우저 확인 (gstack)**

`gstack`으로 카드 클릭 → 상세 이동, git/규칙/실행 섹션 표시 확인.

- [ ] **Step 3: 최종 테스트·빌드**

Run: `npm test && npm run build`
Expected: 모든 테스트 PASS, 빌드 성공.

- [ ] **Step 4: Commit**

```bash
git add "app/project/[name]/page.tsx"
git commit -m "feat: 프로젝트 상세 뷰

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: 자기 프로젝트에 project.json 예시 추가 + README

**Files:**
- Create: `project.json`(이 저장소 루트), `README.md`
- Modify: `AGENTS.md`(한 줄 소개)

**Interfaces:**
- Produces: 대시보드가 자기 자신을 매니페스트 있는 프로젝트로 표시. 실행/설정 문서화.

- [ ] **Step 1: project.json 작성**

`project.json`:
```json
{
  "description": "로컬 맥 프로젝트를 웹 대시보드로 시각화하는 통합 플랫폼",
  "status": "active",
  "progress": 20,
  "run": { "cmd": "npm run dev", "port": 3000 },
  "tags": ["platform", "dashboard"]
}
```

- [ ] **Step 2: README 작성**

`README.md`에 실행법(`npm install`, `npm run dev`, `npm test`), 스캔 루트, `project.json` 스키마 요약, 규칙 목록 기재.

- [ ] **Step 3: AGENTS.md 한 줄 소개 갱신**

`AGENTS.md`의 `(한 줄로 이 프로젝트가 무엇인지 적으세요)`를 실제 소개로 교체:
`로컬 프로젝트 폴더를 스캔해 기술스택·진행도·규칙 위반을 웹 대시보드로 보여주는 플랫폼.`

- [ ] **Step 4: Commit**

```bash
git add project.json README.md AGENTS.md
git commit -m "docs: 매니페스트 예시·README·프로젝트 소개

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (계획 검토)

**Spec coverage:**
- A 시각화: Task 9(그리드)·10(상세) ✓
- 기술스택 아이콘: Task 3(감지)·9/10(표시) ✓
- 설명·진행도(매니페스트): Task 4·7 ✓
- git 상태: Task 5 ✓
- B 규칙 검사: Task 6, UI 표시 9·10 ✓
- 읽기 전용: 스캐너 전 모듈 fs 읽기만, 통합 테스트로 보장 ✓
- 실행 명령 표시만(E는 비범위): Task 10 버튼 비활성 ✓
- 매니페스트 없으면 흐릿하게: Task 9 카드 opacity ✓

**Placeholder scan:** 모든 코드 단계에 실제 코드 포함. "TBD/TODO" 없음. Task 11 README만 서술형이나 이는 문서 작성 지시로 허용 범위.

**Type consistency:** `ProjectInfo`/`StackItem`/`RuleViolation`/`Status` 필드가 Task 2 정의와 이후 사용 일치. `scanProjects`/`buildProjectInfo` 시그니처 일관. `STACK_REGISTRY` id가 detectStack과 mergeStack에서 동일 사용. `folderName` 라우트 키 일관(9→10).
