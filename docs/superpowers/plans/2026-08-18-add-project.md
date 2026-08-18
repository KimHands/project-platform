# 프로젝트 추가 (D) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대시보드에서 새 프로젝트를 추가하면 로컬 맥의 `~/Desktop/Projects`(또는 Career) 아래에 규칙 준수 골격 폴더(CLAUDE.md·AGENTS.md·project.json)가 안전하게 생성된다.

**Architecture:** 쓰기는 `lib/creator/` 새 모듈에만 격리(스캐너는 계속 읽기 전용). 순수 함수 `scaffold`·`validateNewProject`를 TDD로, `createProject`가 실제 fs 쓰기, `POST /api/projects`가 이를 노출, 대시보드 모달 폼이 호출.

**Tech Stack:** Next.js 16 App Router(Route Handler), TypeScript, Vitest, React 클라이언트 컴포넌트.

## Global Constraints

- 쓰기는 오직 `lib/creator/` 안에서만. `lib/scanner/`는 읽기 전용 유지.
- 폴더명 규칙 `/^[a-z0-9-]+$/` — node 의존성 없는 `lib/rules.ts`의 `FOLDER_RE`를 단일 출처로 서버·클라이언트 양쪽에서 재사용. `/`·`..`·`.`·공백·한글 차단.
- 카테고리는 `project` | `career`만. 쓰기는 설정된 두 root(`ROOTS`) 아래에서만.
- 덮어쓰기 금지: 대상 폴더 존재 시 실패(`code: 'exists'`, HTTP 409). 절대 덮어쓰지 않음.
- 경로 재검증: `path.resolve(target)`가 root 바로 아래인지 확인(방어 심층화).
- 생성된 매니페스트는 `parseManifest`로 읽었을 때 `invalid: false`.
- API 오류 형식: `{ error: string, code: 'invalid'|'exists'|'server' }` + HTTP 400/409/500.
- TDD: 순수 함수는 실패 테스트 먼저.
- 커밋 메시지 말미: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## Task 1: FOLDER_RE를 client-safe 모듈로 추출

**Files:**
- Create: `lib/rules.ts`
- Modify: `lib/scanner/checkRules.ts`
- Test: `lib/scanner/checkRules.test.ts` (기존, 회귀 확인)

**Interfaces:**
- Produces: `export const FOLDER_RE = /^[a-z0-9-]+$/` from `lib/rules.ts` (node 의존성 없음 → 서버·클라이언트 모두 import 가능).

- [ ] **Step 1: lib/rules.ts 생성**

`lib/rules.ts` (node import 절대 금지 — 클라이언트 번들에 들어감):
```ts
// 폴더명 규칙의 단일 출처. node 의존성 없이 서버·클라이언트 양쪽에서 재사용.
export const FOLDER_RE = /^[a-z0-9-]+$/
```

- [ ] **Step 2: checkRules.ts가 lib/rules.ts를 사용하도록 변경**

`lib/scanner/checkRules.ts`에서 기존 로컬 상수 줄:
```ts
const FOLDER_RE = /^[a-z0-9-]+$/
```
을 삭제하고, 파일 상단 import에 추가:
```ts
import { FOLDER_RE } from '@/lib/rules'
```
사용처 `FOLDER_RE.test(folderName)`는 그대로 동작한다.

- [ ] **Step 3: 회귀 테스트 확인**

Run: `npx vitest run lib/scanner/checkRules.test.ts`
Expected: 기존 6 tests PASS (동작 변화 없음, 상수 위치만 이동).

- [ ] **Step 4: Commit**

```bash
git add lib/rules.ts lib/scanner/checkRules.ts
git commit -m "refactor: FOLDER_RE를 client-safe lib/rules.ts로 추출

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: scaffold.ts — 골격 파일 내용 생성 (TDD)

**Files:**
- Create: `lib/creator/scaffold.ts`
- Test: `lib/creator/scaffold.test.ts`

**Interfaces:**
- Consumes: `Status` from `@/lib/scanner/types`; `parseManifest` from `@/lib/scanner/parseManifest` (테스트에서 라운드트립 확인용).
- Produces:
  - `export function claudeMd(): string`
  - `export function agentsMd(name: string, description?: string): string`
  - `export function manifestJson(input: { description?: string; status?: Status; tags?: string[] }): string`

- [ ] **Step 1: vitest include에 lib/creator 포함 확인**

`vitest.config.ts`의 `include`는 현재 `['lib/**/*.test.ts', 'scripts/**/*.test.ts']`이다. `lib/creator/*.test.ts`는 `lib/**`에 이미 매칭되므로 **변경 불필요**. 확인만.

- [ ] **Step 2: 실패 테스트 작성**

`lib/creator/scaffold.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { claudeMd, agentsMd, manifestJson } from './scaffold'
import { parseManifest } from '@/lib/scanner/parseManifest'

describe('claudeMd', () => {
  it('첫 줄이 @AGENTS.md', () => {
    expect(claudeMd()).toBe('@AGENTS.md\n')
  })
})

describe('agentsMd', () => {
  it('제목과 설명을 포함', () => {
    const md = agentsMd('my-app', '설명입니다')
    expect(md).toContain('# my-app')
    expect(md).toContain('설명입니다')
    expect(md).toContain('## 이 프로젝트에서 항상 지킬 것')
  })
  it('설명이 없으면 안내 문구', () => {
    const md = agentsMd('my-app')
    expect(md).toContain('# my-app')
    expect(md).toContain('(한 줄로 이 프로젝트가 무엇인지 적으세요)')
  })
})

describe('manifestJson', () => {
  it('parseManifest 라운드트립 시 invalid가 아니다', async () => {
    const json = manifestJson({ description: 'x', status: 'planning', tags: ['a'] })
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-'))
    try {
      await fs.writeFile(path.join(dir, 'project.json'), json)
      const r = await parseManifest(dir)
      expect(r.invalid).toBe(false)
      expect(r.manifest).toMatchObject({ description: 'x', status: 'planning' })
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
  it('빈 값은 생략한다', () => {
    const json = manifestJson({ description: '', status: 'planning' })
    const obj = JSON.parse(json)
    expect(obj.description).toBeUndefined()
    expect('tags' in obj).toBe(false)
    expect(obj.status).toBe('planning')
  })
})
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npx vitest run lib/creator/scaffold.test.ts`
Expected: FAIL — `./scaffold` 모듈 없음.

- [ ] **Step 4: scaffold.ts 구현**

`lib/creator/scaffold.ts`:
```ts
import type { Status } from '@/lib/scanner/types'

export function claudeMd(): string {
  return '@AGENTS.md\n'
}

export function agentsMd(name: string, description?: string): string {
  const desc = description && description.trim()
    ? description.trim()
    : '(한 줄로 이 프로젝트가 무엇인지 적으세요)'
  return `# ${name}

${desc}

## 이 프로젝트에서 항상 지킬 것
- 형식 규칙: \`~/Ops/domains/\` 에서 해당하는 것을 참조 (deck / hwp / web / paper)
- (작업하다 "또 이걸 어겼네" 싶은 게 생기면 여기에 한 줄씩 추가하세요)
`
}

export function manifestJson(input: {
  description?: string
  status?: Status
  tags?: string[]
}): string {
  const obj: Record<string, unknown> = {}
  if (input.description && input.description.trim()) obj.description = input.description.trim()
  if (input.status) obj.status = input.status
  if (input.tags && input.tags.length > 0) obj.tags = input.tags
  return JSON.stringify(obj, null, 2) + '\n'
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run lib/creator/scaffold.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add lib/creator/scaffold.ts lib/creator/scaffold.test.ts
git commit -m "feat(creator): 골격 파일 내용 생성 함수

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: validateNewProject.ts — 입력 검증 (TDD)

**Files:**
- Create: `lib/creator/validateNewProject.ts`
- Test: `lib/creator/validateNewProject.test.ts`

**Interfaces:**
- Consumes: `FOLDER_RE` from `@/lib/rules`; `Category`, `Status` from `@/lib/scanner/types`.
- Produces:
  - `export interface NewProjectInput { name: string; category: Category; description?: string; status?: Status; tags?: string[] }`
  - `export function validateNewProject(input: NewProjectInput): { ok: boolean; errors: string[] }`

- [ ] **Step 1: 실패 테스트 작성**

`lib/creator/validateNewProject.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { validateNewProject } from './validateNewProject'

const base = { name: 'my-app', category: 'project' as const }

describe('validateNewProject', () => {
  it('정상 입력은 ok', () => {
    expect(validateNewProject(base)).toEqual({ ok: true, errors: [] })
  })
  it('대문자 이름 거부', () => {
    const r = validateNewProject({ ...base, name: 'MyApp' })
    expect(r.ok).toBe(false)
    expect(r.errors.join()).toContain('폴더명')
  })
  it('한글 이름 거부', () => {
    expect(validateNewProject({ ...base, name: '프로젝트' }).ok).toBe(false)
  })
  it('슬래시/경로 이름 거부', () => {
    expect(validateNewProject({ ...base, name: 'a/b' }).ok).toBe(false)
    expect(validateNewProject({ ...base, name: '..' }).ok).toBe(false)
    expect(validateNewProject({ ...base, name: 'a b' }).ok).toBe(false)
  })
  it('빈 이름 거부', () => {
    expect(validateNewProject({ ...base, name: '' }).ok).toBe(false)
  })
  it('잘못된 카테고리 거부', () => {
    const r = validateNewProject({ name: 'ok', category: 'wrong' as never })
    expect(r.ok).toBe(false)
    expect(r.errors.join()).toContain('카테고리')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run lib/creator/validateNewProject.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: validateNewProject.ts 구현**

`lib/creator/validateNewProject.ts`:
```ts
import { FOLDER_RE } from '@/lib/rules'
import type { Category, Status } from '@/lib/scanner/types'

export interface NewProjectInput {
  name: string
  category: Category
  description?: string
  status?: Status
  tags?: string[]
}

const CATEGORIES: Category[] = ['project', 'career']

export function validateNewProject(
  input: NewProjectInput,
): { ok: boolean; errors: string[] } {
  const errors: string[] = []
  if (!FOLDER_RE.test(input.name)) {
    errors.push('폴더명은 ASCII 소문자·숫자·하이픈만 허용됩니다.')
  }
  if (!CATEGORIES.includes(input.category)) {
    errors.push('카테고리는 project 또는 career여야 합니다.')
  }
  return { ok: errors.length === 0, errors }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run lib/creator/validateNewProject.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/creator/validateNewProject.ts lib/creator/validateNewProject.test.ts
git commit -m "feat(creator): 새 프로젝트 입력 검증

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: createProject.ts — 폴더·파일 생성 (통합 TDD)

**Files:**
- Create: `lib/creator/createProject.ts`
- Test: `lib/creator/createProject.test.ts`

**Interfaces:**
- Consumes: `validateNewProject`, `NewProjectInput` (Task 3); `claudeMd`, `agentsMd`, `manifestJson` (Task 2); `ROOTS`, `Root` from `@/config`; `Category` from `@/lib/scanner/types`.
- Produces:
  - `export class CreateError extends Error { code: 'invalid'|'exists'|'server' }`
  - `export async function createProject(input: NewProjectInput, roots?: Root[]): Promise<{ path: string; folderName: string }>`

- [ ] **Step 1: 실패 테스트 작성**

`lib/creator/createProject.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createProject, CreateError } from './createProject'
import { parseManifest } from '@/lib/scanner/parseManifest'

let projRoot: string
let careerRoot: string
let roots: { path: string; category: 'project' | 'career' }[]

beforeEach(async () => {
  projRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'cp-p-'))
  careerRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'cp-c-'))
  roots = [
    { path: projRoot, category: 'project' },
    { path: careerRoot, category: 'career' },
  ]
})
afterEach(async () => {
  await fs.rm(projRoot, { recursive: true, force: true })
  await fs.rm(careerRoot, { recursive: true, force: true })
})

describe('createProject', () => {
  it('골격 3파일을 생성하고 경로를 반환', async () => {
    const res = await createProject(
      { name: 'my-app', category: 'project', description: '데모', status: 'planning', tags: ['x'] },
      roots,
    )
    expect(res.folderName).toBe('my-app')
    expect(res.path).toBe(path.join(projRoot, 'my-app'))
    expect(await fs.readFile(path.join(res.path, 'CLAUDE.md'), 'utf8')).toBe('@AGENTS.md\n')
    expect(await fs.readFile(path.join(res.path, 'AGENTS.md'), 'utf8')).toContain('# my-app')
    const r = await parseManifest(res.path)
    expect(r.invalid).toBe(false)
    expect(r.manifest).toMatchObject({ description: '데모', status: 'planning' })
  })

  it('career 카테고리는 careerRoot 아래에 생성', async () => {
    const res = await createProject({ name: 'road', category: 'career' }, roots)
    expect(res.path).toBe(path.join(careerRoot, 'road'))
  })

  it('잘못된 이름은 CreateError(invalid)', async () => {
    await expect(createProject({ name: 'Bad Name', category: 'project' }, roots))
      .rejects.toMatchObject({ code: 'invalid' })
  })

  it('traversal 이름은 CreateError(invalid)', async () => {
    await expect(createProject({ name: '../evil', category: 'project' }, roots))
      .rejects.toMatchObject({ code: 'invalid' })
  })

  it('이미 존재하면 CreateError(exists), 덮어쓰지 않음', async () => {
    await fs.mkdir(path.join(projRoot, 'dup'))
    await fs.writeFile(path.join(projRoot, 'dup', 'keep.txt'), 'orig')
    await expect(createProject({ name: 'dup', category: 'project' }, roots))
      .rejects.toMatchObject({ code: 'exists' })
    expect(await fs.readFile(path.join(projRoot, 'dup', 'keep.txt'), 'utf8')).toBe('orig')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run lib/creator/createProject.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: createProject.ts 구현**

`lib/creator/createProject.ts`:
```ts
import fs from 'node:fs/promises'
import path from 'node:path'
import { ROOTS, type Root } from '@/config'
import { validateNewProject, type NewProjectInput } from './validateNewProject'
import { claudeMd, agentsMd, manifestJson } from './scaffold'

export class CreateError extends Error {
  code: 'invalid' | 'exists' | 'server'
  constructor(code: 'invalid' | 'exists' | 'server', message: string) {
    super(message)
    this.code = code
    this.name = 'CreateError'
  }
}

async function exists(p: string): Promise<boolean> {
  try { await fs.access(p); return true } catch { return false }
}

export async function createProject(
  input: NewProjectInput,
  roots: Root[] = ROOTS,
): Promise<{ path: string; folderName: string }> {
  const { ok, errors } = validateNewProject(input)
  if (!ok) throw new CreateError('invalid', errors.join(' '))

  const root = roots.find((r) => r.category === input.category)
  if (!root) throw new CreateError('invalid', '카테고리에 해당하는 루트가 없습니다.')

  const target = path.join(root.path, input.name)
  // 방어 심층화: 정규화된 경로가 root 바로 아래인지 재검증
  const rootResolved = path.resolve(root.path)
  const targetResolved = path.resolve(target)
  if (path.dirname(targetResolved) !== rootResolved) {
    throw new CreateError('invalid', '허용되지 않은 경로입니다.')
  }

  if (await exists(target)) {
    throw new CreateError('exists', '같은 이름의 폴더가 이미 있습니다.')
  }

  try {
    await fs.mkdir(target, { recursive: false })
    await fs.writeFile(path.join(target, 'CLAUDE.md'), claudeMd())
    await fs.writeFile(path.join(target, 'AGENTS.md'), agentsMd(input.name, input.description))
    await fs.writeFile(
      path.join(target, 'project.json'),
      manifestJson({ description: input.description, status: input.status, tags: input.tags }),
    )
  } catch (e) {
    throw new CreateError('server', `생성 실패: ${(e as Error).message}`)
  }

  return { path: target, folderName: input.name }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run lib/creator/createProject.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: 전체 회귀 확인**

Run: `npm test`
Expected: 기존 + 신규 전부 PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/creator/createProject.ts lib/creator/createProject.test.ts
git commit -m "feat(creator): 규칙 준수 골격 폴더 생성

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: POST API + 대시보드 모달 폼

**Files:**
- Modify: `app/api/projects/route.ts`
- Create: `components/NewProjectDialog.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `createProject`, `CreateError` (Task 4); `validateNewProject` (Task 3, 클라이언트 실시간 검증용); `ROOTS`는 서버 전용이라 클라이언트에서 미사용.
- Produces: `POST /api/projects` → 성공 201 `{ path, folderName }`, 실패 `{ error, code }` + 400/409/500. 대시보드 "+ 새 프로젝트" 버튼·모달.

- [ ] **Step 1: POST 핸들러 추가**

`app/api/projects/route.ts`에 기존 GET 아래로 추가(기존 import 유지, 상단에 createProject import 추가):
```ts
import { createProject, CreateError } from '@/lib/creator/createProject'

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청 본문', code: 'invalid' }, { status: 400 })
  }
  const { name, category, description, status, tags } = (body ?? {}) as Record<string, unknown>
  try {
    const res = await createProject({
      name: String(name ?? ''),
      category: category as 'project' | 'career',
      description: description ? String(description) : undefined,
      status: status as undefined,
      tags: Array.isArray(tags) ? (tags as string[]) : undefined,
    })
    return NextResponse.json(res, { status: 201 })
  } catch (e) {
    if (e instanceof CreateError) {
      const httpStatus = e.code === 'exists' ? 409 : e.code === 'invalid' ? 400 : 500
      return NextResponse.json({ error: e.message, code: e.code }, { status: httpStatus })
    }
    return NextResponse.json({ error: '서버 오류', code: 'server' }, { status: 500 })
  }
}
```

- [ ] **Step 2: 수동 확인 (API)**

Run (백그라운드 dev 서버 후):
```bash
curl -s -X POST http://localhost:3000/api/projects -H 'content-type: application/json' \
  -d '{"name":"MyBad","category":"project"}' -w '\n%{http_code}\n'
```
Expected: `{"error":"...폴더명...","code":"invalid"}` 와 `400`.

- [ ] **Step 3: NewProjectDialog 컴포넌트 작성**

`components/NewProjectDialog.tsx`:
```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FOLDER_RE } from '@/lib/rules'

export function NewProjectDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState<'project' | 'career'>('project')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('planning')
  const [tags, setTags] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const nameValid = FOLDER_RE.test(name)
  const rootLabel = category === 'project' ? 'Projects' : 'Career'
  const preview = `~/Desktop/${rootLabel}/${name || '<이름>'}`

  async function submit() {
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name, category, description,
          status,
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? '실패'); setBusy(false); return }
      setOpen(false); setBusy(false)
      router.push(`/project/${data.folderName}`)
      router.refresh()
    } catch {
      setError('네트워크 오류'); setBusy(false)
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700">
        + 새 프로젝트
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => !busy && setOpen(false)}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-semibold">새 프로젝트</h2>
        <label className="mb-2 block text-sm">
          폴더명
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1" placeholder="my-project" />
          {name && !nameValid && (
            <span className="text-xs text-red-600">소문자·숫자·하이픈만 가능</span>
          )}
        </label>
        <label className="mb-2 block text-sm">
          카테고리
          <select value={category} onChange={(e) => setCategory(e.target.value as 'project' | 'career')}
            className="mt-1 w-full rounded border px-2 py-1">
            <option value="project">Projects (마감·산출물)</option>
            <option value="career">Career (진로·이력)</option>
          </select>
        </label>
        <label className="mb-2 block text-sm">
          설명
          <input value={description} onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1" />
        </label>
        <div className="mb-2 grid grid-cols-2 gap-2">
          <label className="block text-sm">
            상태
            <select value={status} onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full rounded border px-2 py-1">
              <option value="planning">기획</option>
              <option value="active">진행중</option>
              <option value="paused">중단</option>
              <option value="done">완료</option>
            </select>
          </label>
          <label className="block text-sm">
            태그(쉼표)
            <input value={tags} onChange={(e) => setTags(e.target.value)}
              className="mt-1 w-full rounded border px-2 py-1" placeholder="web, security" />
          </label>
        </div>
        <p className="mb-3 text-xs text-slate-500">생성 위치: <code>{preview}</code></p>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={() => setOpen(false)} disabled={busy}
            className="rounded px-3 py-1.5 text-sm text-slate-600">취소</button>
          <button onClick={submit} disabled={!nameValid || busy}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-40">
            {busy ? '생성 중…' : '생성'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 대시보드 헤더에 버튼 배치**

`app/page.tsx`의 헤더(`<header>` 안, 요약 옆)에 `NewProjectDialog`를 추가. import 추가:
```tsx
import { NewProjectDialog } from '@/components/NewProjectDialog'
```
헤더의 요약 `<div>` 옆에 버튼이 오도록 헤더를 다음 구조로 수정(기존 제목·요약 유지):
```tsx
      <header className="mb-6 flex items-end justify-between">
        <h1 className="text-2xl font-bold">프로젝트 대시보드</h1>
        <div className="flex items-center gap-4">
          <div className="text-sm text-slate-600">
            규칙 위반 <b className="text-red-600">{totalErrors}</b> · 경고{' '}
            <b className="text-amber-600">{totalWarns}</b> · 총 {projects.length}개
          </div>
          <NewProjectDialog />
        </div>
      </header>
```

- [ ] **Step 5: 빌드 + gstack 브라우저 확인**

Run: `npm run build` — 성공 확인.
그다음 web.md에 따라 `gstack`을 명시 호출해 백그라운드 `npm run dev`(3000)에서 `http://localhost:3000` 열기 → "+ 새 프로젝트" 클릭 → 모달 표시, 잘못된 이름(대문자) 시 에러 문구·생성 버튼 비활성, 생성 위치 미리보기 확인. **실제 생성 제출은 하지 않는다**(테스트 폴더가 실제로 만들어짐). 모달 UI만 스크린샷. 확인 후 dev 서버 종료.

- [ ] **Step 6: Commit**

```bash
git add app/api/projects/route.ts components/NewProjectDialog.tsx app/page.tsx
git commit -m "feat: 프로젝트 추가 POST API와 대시보드 모달 폼

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: 문서 + 진행도

**Files:**
- Modify: `README.md`, `project.json`

- [ ] **Step 1: README에 "프로젝트 추가" 섹션 추가**

`README.md`에 대시보드에서 "+ 새 프로젝트"로 규칙 준수 골격(CLAUDE.md·AGENTS.md·project.json)을 로컬에 생성하는 법, 폴더명 규칙, 덮어쓰기 안 함을 기재. 로드맵 표의 D 항목을 "완료"로 갱신.

- [ ] **Step 2: project.json 진행도 갱신**

`project.json`의 `progress`를 `35`에서 `50`으로 올린다.

- [ ] **Step 3: 최종 확인**

Run: `npm test && npm run build`
Expected: 전체 테스트 PASS, 빌드 성공.

- [ ] **Step 4: Commit**

```bash
git add README.md project.json
git commit -m "docs(add-project): 프로젝트 추가 사용법과 진행도 갱신

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (계획 검토)

**Spec coverage:**
- 읽기/쓰기 분리(lib/creator): Task 2·3·4 ✓
- FOLDER_RE 단일 출처 재사용: Task 1(export) + Task 3(consume) ✓
- 규칙 준수 골격 3파일: Task 2(내용) + Task 4(쓰기) ✓
- 검증(이름·카테고리): Task 3 ✓
- 경로 안전·traversal 차단·root 재검증: Task 4 구현 + 테스트 ✓
- 덮어쓰기 금지(exists 409): Task 4 + Task 5 매핑 ✓
- POST API 오류 형식(invalid/exists/server → 400/409/500): Task 5 ✓
- UI 모달·실시간 검증·생성위치 미리보기: Task 5 ✓
- 생성 매니페스트 parseManifest 통과: Task 2·4 테스트 ✓
- 문서·진행도: Task 6 ✓

**Placeholder scan:** 모든 코드 단계에 실제 코드. "TBD/TODO" 없음. Task 6 README만 서술형(문서 지시로 허용).

**Type consistency:** `NewProjectInput`(name, category, description?, status?, tags?)가 Task 3 정의·Task 4 consume·Task 5 POST 조립에서 일치. `createProject(input, roots?)`, `CreateError.code: 'invalid'|'exists'|'server'`가 Task 4 정의·Task 5 HTTP 매핑에서 일치. `claudeMd()`/`agentsMd(name,description?)`/`manifestJson({description?,status?,tags?})`가 Task 2 정의·Task 4 호출에서 일치. `FOLDER_RE`가 Task 1 export·Task 3/UI에서 동일 정규식.
