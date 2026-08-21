# 프로젝트 실행 (E) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 상세 뷰의 "동작" 버튼으로 프로젝트의 매니페스트 `run.cmd`를 detached 프로세스 그룹으로 실행하고, 상태·포트 링크·로그를 보여준다.

**Architecture:** 실행은 `lib/runner/`에만 격리(스캐너 읽기 전용 유지). `resolveRun`이 folderName을 경로안전하게 검증해 매니페스트 cmd를 얻고, `runManager`가 F의 serveManager 패턴대로 detached 프로세스 그룹을 관리(상태파일 영속). `POST/GET /api/run`이 노출, 상세 뷰의 `RunControls`가 조작.

**Tech Stack:** Next.js 16 App Router, TypeScript, Vitest, node child_process(detached process group).

## Global Constraints

- 명령은 오직 그 프로젝트의 `project.json` `run.cmd`에서만. 웹 요청은 `folderName`만 전달; 서버가 매니페스트 재파싱해 cmd 획득. **클라이언트가 명령을 보낼 수 없다.**
- `folderName`은 `FOLDER_RE`(`@/lib/rules`)로 검증(`/`·`..`·`.` 차단). 경로는 `path.dirname(path.resolve(target)) === path.resolve(root)` 재검증. 실행은 두 root(`ROOTS`) 아래 그 폴더에서만.
- 실행: `spawn(cmd, { shell: true, cwd: projectPath, detached: true })`. stop은 프로세스 그룹 kill `process.kill(-pid, 'SIGTERM')`.
- detached + 프로젝트별 상태파일 `~/.project-platform/runs/<folderName>.json`, 로그 `~/.project-platform/runs/<folderName>.log`. 프로젝트당 단일 인스턴스, 여러 프로젝트 동시 실행 가능.
- 스캐너(`lib/scanner`)는 읽기 전용 유지. 실행은 `lib/runner`에만.
- 오류 형식 `{ error, code }`; `RunError.code ∈ 'invalid'|'not-found'|'not-runnable'|'server'`.
- TDD: 순수/얇은 함수 실패 테스트 먼저. 커밋 트레일러 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## Task 1: ProjectInfo에 run 필드 추가

**Files:**
- Modify: `lib/scanner/types.ts`, `lib/scanner/buildProjectInfo.ts`
- Test: `lib/scanner/buildProjectInfo.test.ts` (기존)

**Interfaces:**
- Produces: `ProjectInfo.run?: { cmd: string; port: number | null }` — 매니페스트 `run`을 그대로 실어보냄.

- [ ] **Step 1: 실패 테스트 추가**

`lib/scanner/buildProjectInfo.test.ts`에 다음 테스트를 추가(기존 describe 안):
```ts
  it('매니페스트 run을 ProjectInfo.run으로 전달', async () => {
    const dir = path.join(root, 'runnable')
    await fs.mkdir(dir)
    await fs.writeFile(path.join(dir, 'project.json'),
      JSON.stringify({ run: { cmd: 'npm run dev', port: 3000 } }))
    const info = await buildProjectInfo(dir, 'project')
    expect(info.run).toEqual({ cmd: 'npm run dev', port: 3000 })
    expect(info.runnable).toBe(true)
  })
  it('run 없으면 run은 undefined', async () => {
    const dir = path.join(root, 'bare2')
    await fs.mkdir(dir)
    const info = await buildProjectInfo(dir, 'project')
    expect(info.run).toBeUndefined()
  })
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run lib/scanner/buildProjectInfo.test.ts`
Expected: FAIL — `info.run`이 undefined(전달 안 됨) 또는 타입 없음.

- [ ] **Step 3: types.ts에 run 추가**

`lib/scanner/types.ts`의 `ProjectInfo` 인터페이스에 필드 추가(기존 필드 유지):
```ts
  run?: { cmd: string; port: number | null }
```

- [ ] **Step 4: buildProjectInfo에서 run 전달**

`lib/scanner/buildProjectInfo.ts`의 반환 객체에 추가(기존 필드 사이, `runnable` 근처):
```ts
    run: manifest?.run?.cmd
      ? { cmd: manifest.run.cmd, port: manifest.run.port ?? null }
      : undefined,
```

- [ ] **Step 5: 통과 확인 + 회귀**

Run: `npx vitest run lib/scanner/buildProjectInfo.test.ts`
Expected: PASS (신규 2 + 기존).

Run: `npm test`
Expected: 전체 PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/scanner/types.ts lib/scanner/buildProjectInfo.ts lib/scanner/buildProjectInfo.test.ts
git commit -m "feat(scanner): ProjectInfo에 run(cmd,port) 노출

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: resolveRun — 경로안전 + 매니페스트 cmd

**Files:**
- Create: `lib/runner/resolveRun.ts`
- Test: `lib/runner/resolveRun.test.ts`

**Interfaces:**
- Consumes: `FOLDER_RE` from `@/lib/rules`; `parseManifest` from `@/lib/scanner/parseManifest`; `ROOTS`, `Root` from `@/config`.
- Produces:
  - `interface RunTarget { projectPath: string; cmd: string; port: number | null }`
  - `class RunError extends Error { code: 'invalid'|'not-found'|'not-runnable'|'server' }`
  - `resolveRun(folderName: string, roots?: Root[]): Promise<RunTarget>`

- [ ] **Step 1: 실패 테스트 작성**

`lib/runner/resolveRun.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { resolveRun, RunError } from './resolveRun'

let projRoot: string
let roots: { path: string; category: 'project' | 'career' }[]
beforeEach(async () => {
  projRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'rr-'))
  roots = [{ path: projRoot, category: 'project' }]
})
afterEach(async () => { await fs.rm(projRoot, { recursive: true, force: true }) })

describe('resolveRun', () => {
  it('run.cmd 있으면 경로·cmd·port 반환', async () => {
    const dir = path.join(projRoot, 'app1')
    await fs.mkdir(dir)
    await fs.writeFile(path.join(dir, 'project.json'),
      JSON.stringify({ run: { cmd: 'npm run dev', port: 3000 } }))
    expect(await resolveRun('app1', roots)).toEqual({
      projectPath: dir, cmd: 'npm run dev', port: 3000,
    })
  })
  it('port 없으면 null', async () => {
    const dir = path.join(projRoot, 'app2')
    await fs.mkdir(dir)
    await fs.writeFile(path.join(dir, 'project.json'), JSON.stringify({ run: { cmd: 'python app.py' } }))
    expect((await resolveRun('app2', roots)).port).toBeNull()
  })
  it('잘못된 이름 → invalid', async () => {
    await expect(resolveRun('Bad Name', roots)).rejects.toMatchObject({ code: 'invalid' })
    await expect(resolveRun('../evil', roots)).rejects.toMatchObject({ code: 'invalid' })
  })
  it('없는 폴더 → not-found', async () => {
    await expect(resolveRun('nope', roots)).rejects.toMatchObject({ code: 'not-found' })
  })
  it('run.cmd 없으면 → not-runnable', async () => {
    const dir = path.join(projRoot, 'app3')
    await fs.mkdir(dir)
    await fs.writeFile(path.join(dir, 'project.json'), JSON.stringify({ description: 'x' }))
    await expect(resolveRun('app3', roots)).rejects.toMatchObject({ code: 'not-runnable' })
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run lib/runner/resolveRun.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: resolveRun.ts 구현**

`lib/runner/resolveRun.ts`:
```ts
import fs from 'node:fs/promises'
import path from 'node:path'
import { FOLDER_RE } from '@/lib/rules'
import { parseManifest } from '@/lib/scanner/parseManifest'
import { ROOTS, type Root } from '@/config'

export interface RunTarget { projectPath: string; cmd: string; port: number | null }

export class RunError extends Error {
  code: 'invalid' | 'not-found' | 'not-runnable' | 'server'
  constructor(code: RunError['code'], message: string) {
    super(message); this.code = code; this.name = 'RunError'
  }
}

async function exists(p: string): Promise<boolean> {
  try { await fs.access(p); return true } catch { return false }
}

export async function resolveRun(folderName: string, roots: Root[] = ROOTS): Promise<RunTarget> {
  if (!FOLDER_RE.test(folderName)) throw new RunError('invalid', '잘못된 폴더명입니다.')

  for (const root of roots) {
    const target = path.join(root.path, folderName)
    if (path.dirname(path.resolve(target)) !== path.resolve(root.path)) continue
    if (!(await exists(target))) continue
    const { manifest } = await parseManifest(target)
    if (!manifest?.run?.cmd) throw new RunError('not-runnable', '실행 명령이 없습니다.')
    return { projectPath: target, cmd: manifest.run.cmd, port: manifest.run.port ?? null }
  }
  throw new RunError('not-found', '프로젝트를 찾을 수 없습니다.')
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run lib/runner/resolveRun.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/runner/resolveRun.ts lib/runner/resolveRun.test.ts
git commit -m "feat(runner): folderName→실행대상 안전 해석

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: runManager — detached 프로세스 그룹 관리

**Files:**
- Create: `lib/runner/runManager.ts`
- Test: `lib/runner/runManager.test.ts`

**Interfaces:**
- Consumes: `resolveRun`, `RunError`, `RunTarget` (Task 2).
- Produces:
  - `interface RunState { folderName: string; running: boolean; pid: number | null; port: number | null; startedAt: number | null }`
  - `startRun(folderName, deps?): Promise<RunState>`
  - `stopRun(folderName, deps?): Promise<RunState>`
  - `getRunState(folderName, deps?): Promise<RunState>`
  - `tailLog(folderName, lines?, deps?): Promise<string>`
  - `RunDeps`(주입): `{ resolve, spawn, readState, writeState, rmState, readLog, kill, now }`

- [ ] **Step 1: 실패 테스트 작성**

`lib/runner/runManager.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { startRun, stopRun, getRunState, tailLog } from './runManager'

function makeDeps(overrides = {}) {
  const store: Record<string, string> = {}
  const killed: Array<[number, string | number]> = []
  return {
    store, killed,
    deps: {
      resolve: async (name: string) => ({ projectPath: `/tmp/${name}`, cmd: 'npm run dev', port: 3000 }),
      spawn: () => ({ pid: 5151, unref() {} }),
      readState: async (name: string) => store[name] ?? null,
      writeState: async (name: string, s: string) => { store[name] = s },
      rmState: async (name: string) => { delete store[name] },
      readLog: async () => 'line1\nline2\nline3\n',
      kill: (pid: number, sig: number | string) => {
        if (sig === 0) { if (!store.__alive) throw new Error('dead'); return }
        killed.push([pid, sig])
      },
      now: () => 1000,
      ...overrides,
    },
  }
}

describe('runManager', () => {
  it('startRun: 그룹 detached spawn 후 RunState 반환·상태 기록', async () => {
    const { deps, store } = makeDeps()
    store.__alive = 'y'
    const st = await startRun('app1', deps)
    expect(st).toMatchObject({ folderName: 'app1', running: true, pid: 5151, port: 3000 })
    expect(store.app1).toBeTruthy()
  })
  it('startRun: 이미 running이면 기존 상태 반환(중복 spawn 안 함)', async () => {
    const { deps, store } = makeDeps()
    store.__alive = 'y'
    store.app1 = JSON.stringify({ folderName: 'app1', running: true, pid: 999, port: 3000, startedAt: 1 })
    const st = await startRun('app1', deps)
    expect(st.pid).toBe(999)
  })
  it('stopRun: 프로세스 그룹(-pid) kill 후 상태 정리', async () => {
    const { deps, store, killed } = makeDeps()
    store.__alive = 'y'
    store.app1 = JSON.stringify({ folderName: 'app1', running: true, pid: 5151, port: 3000, startedAt: 1 })
    const st = await stopRun('app1', deps)
    expect(killed).toContainEqual([-5151, 'SIGTERM'])
    expect(st.running).toBe(false)
  })
  it('getRunState: pid 죽었으면 running:false 정리', async () => {
    const { deps, store } = makeDeps()
    store.app1 = JSON.stringify({ folderName: 'app1', running: true, pid: 5151, port: 3000, startedAt: 1 })
    // __alive 미설정 → kill(pid,0) throw
    const st = await getRunState('app1', deps)
    expect(st.running).toBe(false)
  })
  it('tailLog: 마지막 N줄', async () => {
    const { deps } = makeDeps()
    expect(await tailLog('app1', 2, deps)).toBe('line2\nline3')
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run lib/runner/runManager.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: runManager.ts 구현**

`lib/runner/runManager.ts`:
```ts
import { spawn as realSpawn } from 'node:child_process'
import { readFile, writeFile, rm, mkdir } from 'node:fs/promises'
import { openSync, closeSync, mkdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { resolveRun } from './resolveRun'
import type { RunTarget } from './resolveRun'

export interface RunState {
  folderName: string; running: boolean; pid: number | null; port: number | null; startedAt: number | null
}

const DIR = path.join(os.homedir(), '.project-platform', 'runs')
const stateFile = (name: string) => path.join(DIR, `${name}.json`)
const logFile = (name: string) => path.join(DIR, `${name}.log`)

export interface RunDeps {
  resolve?: (folderName: string) => Promise<RunTarget>
  spawn?: (target: RunTarget, logPath: string) => { pid?: number; unref: () => void }
  readState?: (folderName: string) => Promise<string | null>
  writeState?: (folderName: string, s: string) => Promise<void>
  rmState?: (folderName: string) => Promise<void>
  readLog?: (folderName: string) => Promise<string>
  kill?: (pid: number, sig: number | string) => void
  now?: () => number
}

function realSpawnRun(target: RunTarget, logPath: string) {
  mkdirSync(DIR, { recursive: true })
  const fd = openSync(logPath, 'a')
  const child = realSpawn(target.cmd, {
    shell: true, cwd: target.projectPath, detached: true, stdio: ['ignore', fd, fd],
  })
  try { closeSync(fd) } catch {}
  child.unref()
  return child
}

function resolveDeps(deps: RunDeps) {
  return {
    resolve: deps.resolve ?? ((name: string) => resolveRun(name)),
    spawn: deps.spawn ?? realSpawnRun,
    readState: deps.readState ?? (async (n: string) => { try { return await readFile(stateFile(n), 'utf8') } catch { return null } }),
    writeState: deps.writeState ?? (async (n: string, s: string) => { await mkdir(DIR, { recursive: true }); await writeFile(stateFile(n), s) }),
    rmState: deps.rmState ?? (async (n: string) => { try { await rm(stateFile(n)) } catch {} }),
    readLog: deps.readLog ?? (async (n: string) => { try { return await readFile(logFile(n), 'utf8') } catch { return '' } }),
    kill: deps.kill ?? ((pid: number, sig: number | string) => process.kill(pid, sig as NodeJS.Signals)),
    now: deps.now ?? Date.now,
  }
}

function pidAlive(pid: number, kill: (p: number, s: number | string) => void): boolean {
  try { kill(pid, 0); return true } catch { return false }
}
function stopped(folderName: string): RunState {
  return { folderName, running: false, pid: null, port: null, startedAt: null }
}

export async function getRunState(folderName: string, deps: RunDeps = {}): Promise<RunState> {
  const d = resolveDeps(deps)
  const raw = await d.readState(folderName)
  if (!raw) return stopped(folderName)
  let s: RunState
  try { s = JSON.parse(raw) } catch { return stopped(folderName) }
  if (s.pid && pidAlive(s.pid, d.kill)) return { ...s, running: true }
  await d.rmState(folderName)
  return stopped(folderName)
}

export async function startRun(folderName: string, deps: RunDeps = {}): Promise<RunState> {
  const d = resolveDeps(deps)
  const existing = await getRunState(folderName, deps)
  if (existing.running) return existing
  const target = await d.resolve(folderName)
  const child = d.spawn(target, logFile(folderName))
  if (!child.pid) throw new Error('프로세스 시작 실패')
  child.unref()
  const state: RunState = {
    folderName, running: true, pid: child.pid, port: target.port, startedAt: d.now(),
  }
  await d.writeState(folderName, JSON.stringify(state))
  return state
}

export async function stopRun(folderName: string, deps: RunDeps = {}): Promise<RunState> {
  const d = resolveDeps(deps)
  const raw = await d.readState(folderName)
  if (raw) {
    try {
      const s = JSON.parse(raw) as RunState
      if (s.pid) { try { d.kill(-s.pid, 'SIGTERM') } catch {} }
    } catch {}
  }
  await d.rmState(folderName)
  return stopped(folderName)
}

export async function tailLog(folderName: string, lines = 200, deps: RunDeps = {}): Promise<string> {
  const d = resolveDeps(deps)
  const text = await d.readLog(folderName)
  return text.split('\n').filter((l) => l.length > 0).slice(-lines).join('\n')
}
```

- [ ] **Step 4: 통과 확인 + 회귀**

Run: `npx vitest run lib/runner/runManager.test.ts`
Expected: PASS (5 tests)

Run: `npm test`
Expected: 전체 PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/runner/runManager.ts lib/runner/runManager.test.ts
git commit -m "feat(runner): detached 프로세스 그룹 실행 관리

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: API 라우트 (/api/run, /api/run/logs)

**Files:**
- Create: `app/api/run/route.ts`, `app/api/run/logs/route.ts`

**Interfaces:**
- Consumes: `startRun`, `stopRun`, `getRunState`, `tailLog` (Task 3); `RunError` (Task 2).
- Produces: `POST /api/run` `{folderName, action}`, `GET /api/run?folderName=`, `GET /api/run/logs?folderName=`.

- [ ] **Step 1: /api/run 라우트 작성**

`app/api/run/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { startRun, stopRun, getRunState } from '@/lib/runner/runManager'
import { RunError } from '@/lib/runner/resolveRun'

export const dynamic = 'force-dynamic'

function codeToStatus(code: RunError['code']): number {
  return code === 'not-found' ? 404 : code === 'server' ? 500 : 400
}

export async function GET(request: Request) {
  const name = new URL(request.url).searchParams.get('folderName') ?? ''
  return NextResponse.json(await getRunState(name))
}

export async function POST(request: Request) {
  let body: { folderName?: string; action?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: '잘못된 본문', code: 'invalid' }, { status: 400 }) }
  const folderName = String(body.folderName ?? '')
  try {
    if (body.action === 'stop') return NextResponse.json(await stopRun(folderName))
    if (body.action !== 'start') return NextResponse.json({ error: 'action은 start|stop', code: 'invalid' }, { status: 400 })
    return NextResponse.json(await startRun(folderName))
  } catch (e) {
    if (e instanceof RunError) return NextResponse.json({ error: e.message, code: e.code }, { status: codeToStatus(e.code) })
    return NextResponse.json({ error: '서버 오류', code: 'server' }, { status: 500 })
  }
}
```

- [ ] **Step 2: /api/run/logs 라우트 작성**

`app/api/run/logs/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { tailLog } from '@/lib/runner/runManager'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const name = new URL(request.url).searchParams.get('folderName') ?? ''
  return NextResponse.json({ log: await tailLog(name) })
}
```

- [ ] **Step 3: 빌드 + 안전한 수동 확인**

Run: `npm run build` — 성공 확인.
백그라운드 `npm run dev` 후 GET만 확인(실제 start는 하지 말 것 — 프로세스가 실제로 뜸):
```bash
curl -s 'http://localhost:3000/api/run?folderName=project-platform' ; echo
curl -s -X POST http://localhost:3000/api/run -H 'content-type: application/json' -d '{"folderName":"Bad Name","action":"start"}' -w '\n%{http_code}\n'
```
Expected: 첫 줄 `{"folderName":"project-platform","running":false,...}`; 둘째 `...code":"invalid"` + `400`. dev 서버 종료.

- [ ] **Step 4: Commit**

```bash
git add app/api/run/route.ts app/api/run/logs/route.ts
git commit -m "feat(runner): /api/run status·start·stop·logs 라우트

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: RunControls UI (상세 뷰)

**Files:**
- Create: `components/RunControls.tsx`
- Modify: `app/project/[name]/page.tsx`

**Interfaces:**
- Consumes: `POST/GET /api/run`, `GET /api/run/logs`; `ProjectInfo.run` (Task 1).
- Produces: 상세 뷰 실행 섹션의 동작/중지·상태·포트링크·로그.

- [ ] **Step 1: RunControls 컴포넌트 작성**

`components/RunControls.tsx`:
```tsx
'use client'
import { useEffect, useState, useCallback } from 'react'

interface RunState { folderName: string; running: boolean; pid: number | null; port: number | null; startedAt: number | null }

export function RunControls({ folderName, cmd, port, projectPath }: {
  folderName: string; cmd: string; port: number | null; projectPath: string
}) {
  const [state, setState] = useState<RunState | null>(null)
  const [log, setLog] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const s = await (await fetch(`/api/run?folderName=${encodeURIComponent(folderName)}`)).json()
      setState(s)
      if (s.running) {
        const l = await (await fetch(`/api/run/logs?folderName=${encodeURIComponent(folderName)}`)).json()
        setLog(l.log ?? '')
      }
    } catch {}
  }, [folderName])
  useEffect(() => { load(); const t = setInterval(load, 3000); return () => clearInterval(t) }, [load])

  async function act(action: 'start' | 'stop') {
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/run', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ folderName, action }),
      })
      const d = await res.json()
      if (!res.ok) setError(d.error ?? '실패')
      await load()
    } catch { setError('네트워크 오류') } finally { setBusy(false) }
  }

  const running = state?.running
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">실행 명령: <code>{cmd}</code> · <span className="break-all">{projectPath}</span></p>
      <div className="flex items-center gap-2">
        {running ? (
          <button onClick={() => act('stop')} disabled={busy}
            className="rounded bg-red-600 px-3 py-1.5 text-sm text-white disabled:opacity-40">중지</button>
        ) : (
          <button onClick={() => act('start')} disabled={busy}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-40">
            {busy ? '시작 중…' : '동작'}
          </button>
        )}
        {running && <span className="text-xs text-green-700">실행 중 (PID {state!.pid})</span>}
        {running && port && (
          <a href={`http://localhost:${port}`} target="_blank" rel="noreferrer"
            className="text-xs text-blue-600 underline">localhost:{port} 열기</a>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {running && log && (
        <pre className="max-h-48 overflow-auto rounded bg-slate-900 p-2 text-xs text-slate-100">{log}</pre>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 상세 뷰 실행 섹션 교체**

`app/project/[name]/page.tsx`에서 상단 import 추가:
```tsx
import { RunControls } from '@/components/RunControls'
```
기존 실행 섹션(비활성 "동작 (곧 지원)" 버튼 블록)을 다음으로 교체:
```tsx
      <section className="mb-6">
        <h2 className="mb-2 font-semibold">실행</h2>
        {p.runnable && p.run ? (
          <RunControls folderName={p.folderName} cmd={p.run.cmd} port={p.run.port} projectPath={p.path} />
        ) : <p className="text-sm text-slate-500">실행 명령 미정의</p>}
      </section>
```

- [ ] **Step 3: 빌드 + gstack 확인**

Run: `npm run build` — 성공.
`gstack`로 백그라운드 `npm run dev`(3000)에서 `http://localhost:3000/project/project-platform` 열어 실행 섹션 확인: 실행 명령 표시·"동작" 버튼. **동작 버튼을 실제로 클릭하지 말 것**(프로세스가 실제로 뜸). 스크린샷. dev 종료.

- [ ] **Step 4: Commit**

```bash
git add components/RunControls.tsx "app/project/[name]/page.tsx"
git commit -m "feat(runner): 상세 뷰 실행 컨트롤(동작/중지·포트·로그)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: 문서 + 진행도

**Files:**
- Modify: `README.md`, `project.json`

- [ ] **Step 1: README에 "프로젝트 실행" 섹션**

`README.md`에 섹션 추가: 상세 뷰에서 "동작"으로 매니페스트 `run.cmd`를 실행(프로세스 그룹, 로그·포트 링크), 명령은 매니페스트에서만 옴(보안), 중지는 프로세스 트리 정리. 로드맵 표 E 항목을 "완료"로. (E 완료로 로드맵 전부 완성 표기)

- [ ] **Step 2: project.json 진행도 갱신**

`project.json`의 `progress`를 `70`에서 `100`으로.

- [ ] **Step 3: 최종 확인**

Run: `npm test && npm run build`
Expected: 전체 PASS, 빌드 성공.

- [ ] **Step 4: Commit**

```bash
git add README.md project.json
git commit -m "docs(runner): 프로젝트 실행 사용법과 진행도 100 갱신

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (계획 검토)

**Spec coverage:**
- 명령은 매니페스트에서만·클라 미주입: Task 2(resolveRun 서버측 재파싱)·4(body는 folderName만) ✓
- 경로안전(FOLDER_RE·dirname 재검증): Task 2 ✓
- detached 프로세스 그룹·상태파일·다중 실행: Task 3 ✓
- stop=그룹 kill(-pid): Task 3 + 테스트 ✓
- ProjectInfo.run 노출(투명성): Task 1 ✓
- API(start/stop/state/logs): Task 4 ✓
- UI(명령표시·동작/중지·포트링크·로그): Task 5 ✓
- 스캐너 읽기전용 유지: runner 분리 ✓
- 문서·진행도: Task 6 ✓

**Placeholder scan:** 모든 코드 단계 실제 코드. Task 6 README 서술형(허용).

**Type consistency:** `RunTarget`(projectPath,cmd,port)·`RunError.code`·`RunState`(folderName,running,pid,port,startedAt)가 Task 2·3·4 일치. `ProjectInfo.run`(cmd,port) Task 1 정의·Task 5 사용 일치. `resolveRun/startRun/stopRun/getRunState/tailLog` 시그니처 일관. API code→status 매핑이 RunError.code와 일치.

**리스크:** `spawn(shell:true)`는 신뢰된 매니페스트 명령만 실행(웹 미주입) — 스펙 보안모델대로. 프로세스 그룹 kill은 detached spawn이 그룹 리더를 만들어 `-pid`로 정리.
