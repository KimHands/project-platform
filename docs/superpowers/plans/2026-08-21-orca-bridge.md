# Orca 연동 (F) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대시보드에서 노트북의 Orca를 "원격 이어가기 모드"(detached `orca serve`)로 켜고, 집 Windows 브라우저용 URL·모바일 QR을 얻어 다른 기기에서 세션을 이어갈 수 있게 한다.

**Architecture:** 쓰기/실행은 `lib/orca/` 새 모듈에만 격리. 순수 파서(status/serve/env)·주소 분류를 TDD로, `serveManager`가 detached `orca serve` 프로세스를 상태파일로 관리, `GET /api/orca/status`·`POST /api/orca/serve`가 노출, 대시보드 `OrcaPanel`이 조작.

**Tech Stack:** Next.js 16 App Router(Route Handler), TypeScript, Vitest, `qrcode.react`(QR), node child_process(detached spawn).

## Global Constraints

- 서버는 **고정된 orca 서브커맨드만** 실행: `status`, `environment list`, `serve --pairing-address <검증주소> --mobile-pairing`. execFile/spawn + 배열 인자(셸 없음). 임의 실행 금지.
- `--pairing-address`는 **사설 IP만** 허용: Tailscale `100.64.0.0/10`, `10/8`, `172.16/12`, `192.168/16`, 루프백 `127.0.0.0/8`. 공개 IP·도메인 거부.
- "원격 이어가기 시작"은 명시적 클릭. **데스크톱 실행 중이면 거부(409)** — 자동 종료 안 함. 공개 주소 거부(400).
- detached serve는 대시보드(Next) 재시작에도 유지(`detached:true`+`unref()`). 상태·로그는 `~/.project-platform/`.
- orca/tailscale 부재·실패 시 안전 기본값 반환, 크래시 없음.
- 타입 계약: `OrcaStatus`, `OrcaEnvironment`, `ServeInfo`, `Reachability`, `ServeState`(스펙과 동일).
- TDD: 순수 함수는 실패 테스트 먼저. 커밋 트레일러 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## Task 1: orca JSON 파서 (status + environment)

**Files:**
- Create: `lib/orca/types.ts`, `lib/orca/statusParse.ts`, `lib/orca/envParse.ts`
- Test: `lib/orca/statusParse.test.ts`, `lib/orca/envParse.test.ts`

**Interfaces:**
- Produces:
  - `types.ts`: `OrcaStatus`, `OrcaEnvironment`, `ServeInfo`, `AddressKind`, `Reachability`, `ServeState`.
  - `statusParse(jsonText: string): OrcaStatus`
  - `envParse(jsonText: string): OrcaEnvironment[]`

- [ ] **Step 1: types.ts 작성**

`lib/orca/types.ts`:
```ts
export interface OrcaStatus {
  installed: boolean
  desktopRunning: boolean
  ready: boolean
  version: string | null
  reachable: boolean
}
export interface OrcaEnvironment {
  name: string
  endpoint?: string
  [k: string]: unknown
}
export interface ServeInfo {
  endpoint: string | null
  browserUrl: string | null
  mobileUrl: string | null
}
export type AddressKind = 'tailscale' | 'lan' | 'loopback' | 'public'
export interface Reachability {
  address: string | null
  kind: AddressKind
  allowed: boolean
  tailscaleAvailable: boolean
}
export interface ServeState {
  running: boolean
  pid: number | null
  address: string | null
  serve: ServeInfo | null
  startedAt: number | null
}
```

- [ ] **Step 2: statusParse 실패 테스트 작성**

`lib/orca/statusParse.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { statusParse } from './statusParse'

// 실측 `orca status --json` 축약본
const REAL = JSON.stringify({
  id: 'local-status', ok: true,
  result: {
    app: { running: true, pid: 37899, desktopWindowStatus: 'available' },
    runtime: { state: 'ready', reachable: true, appVersion: '1.4.184' },
    graph: { state: 'ready' },
  },
})

describe('statusParse', () => {
  it('실측 JSON을 OrcaStatus로 매핑', () => {
    expect(statusParse(REAL)).toEqual({
      installed: true, desktopRunning: true, ready: true,
      version: '1.4.184', reachable: true,
    })
  })
  it('데스크톱 미실행·런타임 미준비', () => {
    const j = JSON.stringify({ ok: true, result: { app: { running: false }, runtime: { state: 'starting', reachable: false, appVersion: '1.4.184' } } })
    expect(statusParse(j)).toMatchObject({ desktopRunning: false, ready: false, reachable: false })
  })
  it('깨진/빈 입력은 installed:false 안전값', () => {
    expect(statusParse('not json')).toEqual({
      installed: false, desktopRunning: false, ready: false, version: null, reachable: false,
    })
    expect(statusParse('')).toMatchObject({ installed: false })
  })
})
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run lib/orca/statusParse.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 4: statusParse 구현**

`lib/orca/statusParse.ts`:
```ts
import type { OrcaStatus } from './types'

const SAFE: OrcaStatus = {
  installed: false, desktopRunning: false, ready: false, version: null, reachable: false,
}

export function statusParse(jsonText: string): OrcaStatus {
  let d: unknown
  try { d = JSON.parse(jsonText) } catch { return { ...SAFE } }
  if (typeof d !== 'object' || d === null) return { ...SAFE }
  const result = (d as Record<string, unknown>).result as Record<string, unknown> | undefined
  const app = (result?.app ?? {}) as Record<string, unknown>
  const runtime = (result?.runtime ?? {}) as Record<string, unknown>
  return {
    installed: true,
    desktopRunning: app.running === true,
    ready: runtime.state === 'ready',
    version: typeof runtime.appVersion === 'string' ? runtime.appVersion : null,
    reachable: runtime.reachable === true,
  }
}
```

- [ ] **Step 5: statusParse 통과 확인**

Run: `npx vitest run lib/orca/statusParse.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: envParse 실패 테스트 작성**

`lib/orca/envParse.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { envParse } from './envParse'

describe('envParse', () => {
  it('환경 목록을 배열로', () => {
    const j = JSON.stringify({ ok: true, result: { environments: [
      { name: 'work-laptop', endpoint: 'wss://100.64.1.20:6768' },
    ] } })
    expect(envParse(j)).toEqual([{ name: 'work-laptop', endpoint: 'wss://100.64.1.20:6768' }])
  })
  it('빈 목록', () => {
    expect(envParse(JSON.stringify({ ok: true, result: { environments: [] } }))).toEqual([])
  })
  it('깨진/누락은 빈 배열', () => {
    expect(envParse('nope')).toEqual([])
    expect(envParse(JSON.stringify({ ok: true, result: {} }))).toEqual([])
  })
})
```

- [ ] **Step 7: envParse 구현 + 통과**

`lib/orca/envParse.ts`:
```ts
import type { OrcaEnvironment } from './types'

export function envParse(jsonText: string): OrcaEnvironment[] {
  let d: unknown
  try { d = JSON.parse(jsonText) } catch { return [] }
  const envs = (d as { result?: { environments?: unknown } })?.result?.environments
  if (!Array.isArray(envs)) return []
  return envs.filter((e): e is OrcaEnvironment =>
    typeof e === 'object' && e !== null && typeof (e as { name?: unknown }).name === 'string')
}
```

Run: `npx vitest run lib/orca/envParse.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 8: Commit**

```bash
git add lib/orca/types.ts lib/orca/statusParse.ts lib/orca/envParse.ts lib/orca/statusParse.test.ts lib/orca/envParse.test.ts
git commit -m "feat(orca): status/environment JSON 파서

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: reachability — 주소 분류 + Tailscale 감지

**Files:**
- Create: `lib/orca/reachability.ts`
- Test: `lib/orca/reachability.test.ts`

**Interfaces:**
- Consumes: `AddressKind`, `Reachability` from `./types`.
- Produces:
  - `classifyAddress(ip: string): AddressKind`
  - `isAllowedAddress(ip: string): boolean`  // public 외 전부 true
  - `detectReachability(deps?): Promise<Reachability>`  // Tailscale IP 감지(없으면 address:null)

- [ ] **Step 1: 실패 테스트 작성**

`lib/orca/reachability.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { classifyAddress, isAllowedAddress, detectReachability } from './reachability'

describe('classifyAddress', () => {
  it('Tailscale CGNAT 100.64/10', () => {
    expect(classifyAddress('100.64.1.20')).toBe('tailscale')
    expect(classifyAddress('100.127.255.1')).toBe('tailscale')
  })
  it('사설 LAN', () => {
    expect(classifyAddress('192.168.0.5')).toBe('lan')
    expect(classifyAddress('10.1.2.3')).toBe('lan')
    expect(classifyAddress('172.16.5.5')).toBe('lan')
  })
  it('루프백', () => { expect(classifyAddress('127.0.0.1')).toBe('loopback') })
  it('공개 IP·도메인', () => {
    expect(classifyAddress('8.8.8.8')).toBe('public')
    expect(classifyAddress('example.com')).toBe('public')
    expect(classifyAddress('172.32.0.1')).toBe('public') // 172.16~31만 사설
  })
})

describe('isAllowedAddress', () => {
  it('사설/tailscale/loopback 허용, public 거부', () => {
    expect(isAllowedAddress('100.64.1.20')).toBe(true)
    expect(isAllowedAddress('192.168.1.9')).toBe(true)
    expect(isAllowedAddress('127.0.0.1')).toBe(true)
    expect(isAllowedAddress('8.8.8.8')).toBe(false)
  })
})

describe('detectReachability', () => {
  it('tailscale ip가 있으면 그 주소·tailscale', async () => {
    const r = await detectReachability({ runTailscaleIp: async () => '100.64.1.20\n' })
    expect(r).toMatchObject({ address: '100.64.1.20', kind: 'tailscale', allowed: true, tailscaleAvailable: true })
  })
  it('tailscale 없으면 address:null', async () => {
    const r = await detectReachability({ runTailscaleIp: async () => { throw new Error('no tailscale') } })
    expect(r).toEqual({ address: null, kind: 'public', allowed: false, tailscaleAvailable: false })
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run lib/orca/reachability.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: reachability.ts 구현**

`lib/orca/reachability.ts`:
```ts
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { AddressKind, Reachability } from './types'

const run = promisify(execFile)

export function classifyAddress(ip: string): AddressKind {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip)
  if (!m) return 'public'
  const [a, b] = [Number(m[1]), Number(m[2])]
  if (a === 127) return 'loopback'
  if (a === 100 && b >= 64 && b <= 127) return 'tailscale'
  if (a === 10) return 'lan'
  if (a === 172 && b >= 16 && b <= 31) return 'lan'
  if (a === 192 && b === 168) return 'lan'
  return 'public'
}

export function isAllowedAddress(ip: string): boolean {
  return classifyAddress(ip) !== 'public'
}

interface Deps { runTailscaleIp?: () => Promise<string> }

async function defaultTailscaleIp(): Promise<string> {
  const { stdout } = await run('tailscale', ['ip', '-4'])
  return stdout
}

export async function detectReachability(deps: Deps = {}): Promise<Reachability> {
  const runner = deps.runTailscaleIp ?? defaultTailscaleIp
  try {
    const out = await runner()
    const ip = out.split('\n').map((s) => s.trim()).find(Boolean) ?? ''
    if (!ip) return { address: null, kind: 'public', allowed: false, tailscaleAvailable: false }
    const kind = classifyAddress(ip)
    return { address: ip, kind, allowed: kind !== 'public', tailscaleAvailable: true }
  } catch {
    return { address: null, kind: 'public', allowed: false, tailscaleAvailable: false }
  }
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run lib/orca/reachability.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/orca/reachability.ts lib/orca/reachability.test.ts
git commit -m "feat(orca): 주소 분류와 Tailscale 도달성 감지

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: serveParse — serve 출력 파서 (관대한 추출)

**Files:**
- Create: `lib/orca/serveParse.ts`
- Test: `lib/orca/serveParse.test.ts`

**Interfaces:**
- Consumes: `ServeInfo` from `./types`.
- Produces: `serveParse(text: string): ServeInfo`  // JSON 또는 라인 텍스트에서 browser URL / mobile 링크 / ws endpoint 추출.

**참고(실측 리스크):** `orca serve --json`의 정확한 필드명은 데스크톱을 닫아야 캡처 가능해 미확정. 따라서 **관대하게** 파싱한다: JSON이면 값들을 순회하며 (a) `http(s)://`로 시작하는 URL=browserUrl 후보, (b) `orca://` 또는 `pair`/`mobile` 포함 링크=mobileUrl, (c) `ws://`/`wss://`=endpoint. Step 5에서 사용자가 실제 출력으로 확인.

- [ ] **Step 1: 실패 테스트 작성**

`lib/orca/serveParse.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { serveParse } from './serveParse'

describe('serveParse', () => {
  it('JSON에서 browser URL·mobile 링크·ws endpoint 추출', () => {
    const j = JSON.stringify({
      advertisedEndpoint: 'wss://100.64.1.20:6768',
      browserUrl: 'https://100.64.1.20:6768/app?pair=abc',
      mobilePairing: { link: 'orca://pair?code=xyz' },
    })
    expect(serveParse(j)).toEqual({
      endpoint: 'wss://100.64.1.20:6768',
      browserUrl: 'https://100.64.1.20:6768/app?pair=abc',
      mobileUrl: 'orca://pair?code=xyz',
    })
  })
  it('필드가 없으면 각각 null', () => {
    expect(serveParse('{}')).toEqual({ endpoint: null, browserUrl: null, mobileUrl: null })
  })
  it('라인 텍스트 폴백에서도 URL 추출', () => {
    const t = 'Bound endpoint wss://10.0.0.2:6768\nBrowser: https://10.0.0.2:6768/app\nMobile orca://pair?code=q'
    expect(serveParse(t)).toEqual({
      endpoint: 'wss://10.0.0.2:6768',
      browserUrl: 'https://10.0.0.2:6768/app',
      mobileUrl: 'orca://pair?code=q',
    })
  })
  it('깨진 입력은 전부 null', () => {
    expect(serveParse('')).toEqual({ endpoint: null, browserUrl: null, mobileUrl: null })
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run lib/orca/serveParse.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: serveParse 구현**

`lib/orca/serveParse.ts`:
```ts
import type { ServeInfo } from './types'

function collectStrings(v: unknown, out: string[]): void {
  if (typeof v === 'string') out.push(v)
  else if (Array.isArray(v)) v.forEach((x) => collectStrings(x, out))
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => collectStrings(x, out))
}

export function serveParse(text: string): ServeInfo {
  const strings: string[] = []
  try {
    collectStrings(JSON.parse(text), strings)
  } catch {
    // JSON 아니면 라인에서 URL 토큰 추출
    const tokens = text.split(/\s+/)
    strings.push(...tokens)
  }
  const find = (re: RegExp) => strings.find((s) => re.test(s)) ?? null
  const endpoint = find(/^wss?:\/\//)
  const mobileUrl = find(/^orca:\/\//) ?? find(/pair|mobile/i) ?? null
  const browserUrl = strings.find((s) => /^https?:\/\//.test(s) && s !== mobileUrl) ?? null
  return {
    endpoint,
    browserUrl,
    mobileUrl: mobileUrl && /^https?:\/\//.test(mobileUrl) ? mobileUrl : mobileUrl,
  }
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run lib/orca/serveParse.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: (사용자 확인 단계 — 자동화 아님) 실측 캡처 안내를 report에 기록**

`orca serve --json`의 실제 필드명은 데스크톱을 닫아야 확인 가능하다. **이 태스크에서 데스크톱을 강제 종료하지 말 것.** 대신 report에 다음 안내를 남긴다: "사용자가 편할 때 데스크톱을 닫고 `orca serve --json --pairing-address 127.0.0.1 --mobile-pairing`를 몇 초 실행해 출력 필드명을 확인하고, 다르면 serveParse의 키 매칭을 조정." serveParse는 관대한 추출이라 필드명이 달라도 URL 형태(http/ws/orca)로 대부분 잡힌다.

- [ ] **Step 6: Commit**

```bash
git add lib/orca/serveParse.ts lib/orca/serveParse.test.ts
git commit -m "feat(orca): serve 출력에서 접속 URL 관대 추출

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: orcaCli + serveManager (detached serve 관리)

**Files:**
- Create: `lib/orca/orcaCli.ts`, `lib/orca/serveManager.ts`
- Test: `lib/orca/serveManager.test.ts`

**Interfaces:**
- Consumes: `statusParse`, `envParse`, `serveParse`, `isAllowedAddress`, 모든 타입.
- Produces:
  - `orcaCli.ts`: `orcaStatus(): Promise<OrcaStatus>`, `orcaEnvironments(): Promise<OrcaEnvironment[]>` (execFile 래퍼, 실패 시 안전값).
  - `serveManager.ts`:
    - `startServe(address: string, deps?: ServeDeps): Promise<ServeState>`
    - `stopServe(deps?: ServeDeps): Promise<ServeState>`
    - `getServeState(deps?: ServeDeps): Promise<ServeState>`
    - `class ServeError extends Error { code: 'orca-missing'|'desktop-running'|'unreachable'|'already-running'|'spawn-failed' }`
  - `ServeDeps`(테스트 주입): `{ spawn, readFile, writeFile, rmState, kill, now, poll }`.

- [ ] **Step 1: orcaCli.ts 구현 (테스트는 통합에서 간접 검증)**

`lib/orca/orcaCli.ts`:
```ts
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { statusParse } from './statusParse'
import { envParse } from './envParse'
import type { OrcaStatus, OrcaEnvironment } from './types'

const run = promisify(execFile)

export async function orcaStatus(): Promise<OrcaStatus> {
  try {
    const { stdout } = await run('orca', ['status', '--json'])
    return statusParse(stdout)
  } catch {
    return { installed: false, desktopRunning: false, ready: false, version: null, reachable: false }
  }
}

export async function orcaEnvironments(): Promise<OrcaEnvironment[]> {
  try {
    const { stdout } = await run('orca', ['environment', 'list', '--json'])
    return envParse(stdout)
  } catch {
    return []
  }
}
```

- [ ] **Step 2: serveManager 실패 테스트 작성 (주입 deps로 결정적)**

`lib/orca/serveManager.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { startServe, stopServe, getServeState, ServeError } from './serveManager'

function makeDeps(overrides = {}) {
  const files: Record<string, string> = {}
  const killed: number[] = []
  return {
    files, killed,
    deps: {
      desktopRunning: async () => false,
      spawn: () => ({ pid: 4242, unref() {} }),
      readLog: async () => JSON.stringify({ browserUrl: 'https://100.64.1.20:6768/app', advertisedEndpoint: 'wss://100.64.1.20:6768', mobile: 'orca://pair?code=z' }),
      readState: async () => (files.state ? files.state : null),
      writeState: async (s: string) => { files.state = s },
      rmState: async () => { delete files.state },
      kill: (pid: number, sig: number | string) => {
        if (sig === 0) { if (!files.alive) throw new Error('dead'); return }
        killed.push(pid)
      },
      now: () => 1000,
      sleep: async () => {},
      ...overrides,
    },
  }
}

describe('serveManager', () => {
  it('startServe: 공개 주소 거부', async () => {
    const { deps } = makeDeps()
    await expect(startServe('8.8.8.8', deps)).rejects.toMatchObject({ code: 'unreachable' })
  })
  it('startServe: 데스크톱 실행 중 거부', async () => {
    const { deps } = makeDeps({ desktopRunning: async () => true })
    await expect(startServe('100.64.1.20', deps)).rejects.toMatchObject({ code: 'desktop-running' })
  })
  it('startServe: detached 시작 후 ServeState 반환', async () => {
    const { deps, files } = makeDeps()
    files.alive = 'y'
    const st = await startServe('100.64.1.20', deps)
    expect(st).toMatchObject({
      running: true, pid: 4242, address: '100.64.1.20',
      serve: { browserUrl: 'https://100.64.1.20:6768/app', endpoint: 'wss://100.64.1.20:6768', mobileUrl: 'orca://pair?code=z' },
    })
    expect(files.state).toBeTruthy()
  })
  it('stopServe: 저장된 pid kill 후 상태 정리', async () => {
    const { deps, files, killed } = makeDeps()
    files.state = JSON.stringify({ running: true, pid: 4242, address: '100.64.1.20', serve: null, startedAt: 1 })
    files.alive = 'y'
    const st = await stopServe(deps)
    expect(killed).toContain(4242)
    expect(st.running).toBe(false)
  })
  it('getServeState: pid 죽어있으면 running:false로 정리', async () => {
    const { deps, files } = makeDeps()
    files.state = JSON.stringify({ running: true, pid: 4242, address: '100.64.1.20', serve: null, startedAt: 1 })
    // files.alive 미설정 → kill(pid,0) throw
    const st = await getServeState(deps)
    expect(st.running).toBe(false)
  })
})
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run lib/orca/serveManager.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 4: serveManager.ts 구현**

`lib/orca/serveManager.ts`:
```ts
import { spawn as realSpawn } from 'node:child_process'
import { readFile, writeFile, rm, mkdir } from 'node:fs/promises'
import { openSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { isAllowedAddress } from './reachability'
import { serveParse } from './serveParse'
import { orcaStatus } from './orcaCli'
import type { ServeInfo, ServeState } from './types'

export class ServeError extends Error {
  code: 'orca-missing' | 'desktop-running' | 'unreachable' | 'already-running' | 'spawn-failed'
  constructor(code: ServeError['code'], message: string) {
    super(message); this.code = code; this.name = 'ServeError'
  }
}

const DIR = path.join(os.homedir(), '.project-platform')
const STATE = path.join(DIR, 'orca-serve.json')
const LOG = path.join(DIR, 'orca-serve.log')

export interface ServeDeps {
  desktopRunning?: () => Promise<boolean>
  spawn?: (addr: string, logPath: string) => { pid?: number; unref: () => void }
  readLog?: () => Promise<string>
  readState?: () => Promise<string | null>
  writeState?: (s: string) => Promise<void>
  rmState?: () => Promise<void>
  kill?: (pid: number, sig: number | string) => void
  now?: () => number
  sleep?: (ms: number) => Promise<void>
}

function realSpawnServe(addr: string, logPath: string) {
  const fd = openSync(logPath, 'w')
  const child = realSpawn('orca', ['serve', '--pairing-address', addr, '--mobile-pairing', '--json'],
    { detached: true, stdio: ['ignore', fd, fd] })
  child.unref()
  return child
}

function resolve(deps: ServeDeps) {
  return {
    desktopRunning: deps.desktopRunning ?? (async () => (await orcaStatus()).desktopRunning),
    spawn: deps.spawn ?? realSpawnServe,
    readLog: deps.readLog ?? (async () => { try { return await readFile(LOG, 'utf8') } catch { return '' } }),
    readState: deps.readState ?? (async () => { try { return await readFile(STATE, 'utf8') } catch { return null } }),
    writeState: deps.writeState ?? (async (s: string) => { await mkdir(DIR, { recursive: true }); await writeFile(STATE, s) }),
    rmState: deps.rmState ?? (async () => { try { await rm(STATE) } catch {} }),
    kill: deps.kill ?? ((pid: number, sig: number | string) => process.kill(pid, sig as NodeJS.Signals)),
    now: deps.now ?? Date.now,
    sleep: deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms))),
  }
}

function pidAlive(pid: number, kill: (p: number, s: number | string) => void): boolean {
  try { kill(pid, 0); return true } catch { return false }
}

export async function getServeState(deps: ServeDeps = {}): Promise<ServeState> {
  const d = resolve(deps)
  const raw = await d.readState()
  if (!raw) return { running: false, pid: null, address: null, serve: null, startedAt: null }
  let s: ServeState
  try { s = JSON.parse(raw) } catch { return { running: false, pid: null, address: null, serve: null, startedAt: null } }
  if (s.pid && pidAlive(s.pid, d.kill)) return { ...s, running: true }
  await d.rmState()
  return { running: false, pid: null, address: null, serve: null, startedAt: null }
}

export async function startServe(address: string, deps: ServeDeps = {}): Promise<ServeState> {
  const d = resolve(deps)
  if (!isAllowedAddress(address)) throw new ServeError('unreachable', '사설/Tailscale 주소만 허용됩니다.')
  const existing = await getServeState(deps)
  if (existing.running) return existing
  if (await d.desktopRunning()) throw new ServeError('desktop-running', 'Orca 데스크톱을 먼저 닫으세요.')

  const child = d.spawn(address, LOG)
  if (!child.pid) throw new ServeError('spawn-failed', 'orca serve 시작 실패')
  child.unref()

  // 로그 폴링(최대 ~15s)으로 접속 URL 확보
  let serve: ServeInfo = { endpoint: null, browserUrl: null, mobileUrl: null }
  const deadline = d.now() + 15000
  while (d.now() < deadline) {
    if (!pidAlive(child.pid, d.kill)) throw new ServeError('spawn-failed', 'orca serve가 종료되었습니다.')
    serve = serveParse(await d.readLog())
    if (serve.browserUrl || serve.endpoint) break
    await d.sleep(300)
  }
  const state: ServeState = { running: true, pid: child.pid, address, serve, startedAt: d.now() }
  await d.writeState(JSON.stringify(state))
  return state
}

export async function stopServe(deps: ServeDeps = {}): Promise<ServeState> {
  const d = resolve(deps)
  const raw = await d.readState()
  if (raw) {
    try {
      const s = JSON.parse(raw) as ServeState
      if (s.pid) { try { d.kill(s.pid, 'SIGTERM') } catch {} }
    } catch {}
  }
  await d.rmState()
  return { running: false, pid: null, address: null, serve: null, startedAt: null }
}
```

- [ ] **Step 5: 통과 확인 + 전체 회귀**

Run: `npx vitest run lib/orca/serveManager.test.ts`
Expected: PASS (5 tests)

Run: `npm test`
Expected: 전체 PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/orca/orcaCli.ts lib/orca/serveManager.ts lib/orca/serveManager.test.ts
git commit -m "feat(orca): detached serve 프로세스 관리와 CLI 래퍼

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: API 라우트 (status + serve)

**Files:**
- Create: `app/api/orca/status/route.ts`, `app/api/orca/serve/route.ts`

**Interfaces:**
- Consumes: `orcaStatus`, `orcaEnvironments` (Task 4); `detectReachability` (Task 2); `getServeState`, `startServe`, `stopServe`, `ServeError` (Task 4).
- Produces:
  - `GET /api/orca/status` → `{ status, environments, reachability, serve }`
  - `POST /api/orca/serve` `{ action:'start'|'stop' }` → ServeState 또는 `{error, code}`.

- [ ] **Step 1: status 라우트 작성**

`app/api/orca/status/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { orcaStatus, orcaEnvironments } from '@/lib/orca/orcaCli'
import { detectReachability } from '@/lib/orca/reachability'
import { getServeState } from '@/lib/orca/serveManager'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [status, environments, reachability, serve] = await Promise.all([
    orcaStatus(), orcaEnvironments(), detectReachability(), getServeState(),
  ])
  return NextResponse.json({ status, environments, reachability, serve })
}
```

- [ ] **Step 2: serve 라우트 작성**

`app/api/orca/serve/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { startServe, stopServe, ServeError } from '@/lib/orca/serveManager'
import { detectReachability } from '@/lib/orca/reachability'
import { orcaStatus } from '@/lib/orca/orcaCli'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let body: { action?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: '잘못된 본문', code: 'invalid' }, { status: 400 }) }

  if (body.action === 'stop') {
    return NextResponse.json(await stopServe())
  }
  if (body.action !== 'start') {
    return NextResponse.json({ error: 'action은 start|stop', code: 'invalid' }, { status: 400 })
  }
  const status = await orcaStatus()
  if (!status.installed) return NextResponse.json({ error: 'Orca 미설치', code: 'orca-missing' }, { status: 400 })
  const reach = await detectReachability()
  if (!reach.allowed || !reach.address) {
    return NextResponse.json({ error: 'Tailscale 등 사설 주소가 필요합니다.', code: 'unreachable' }, { status: 400 })
  }
  try {
    const state = await startServe(reach.address)
    return NextResponse.json(state, { status: 200 })
  } catch (e) {
    if (e instanceof ServeError) {
      const s = e.code === 'desktop-running' ? 409 : 400
      return NextResponse.json({ error: e.message, code: e.code }, { status: s })
    }
    return NextResponse.json({ error: '서버 오류', code: 'server' }, { status: 500 })
  }
}
```

- [ ] **Step 3: 수동 확인 (안전한 것만)**

Run (백그라운드 dev 후):
```bash
curl -s http://localhost:3000/api/orca/status | python3 -m json.tool | head -30
```
Expected: `status.installed=true`, `status.desktopRunning`(현재 true), `reachability`, `serve.running=false` 포함 JSON.
`POST serve start`는 **실행하지 말 것**(데스크톱 실행 중이라 409가 정상이지만, 실제 serve는 사용자가 수행). dev 서버 종료.

- [ ] **Step 4: Commit**

```bash
git add app/api/orca/status/route.ts app/api/orca/serve/route.ts
git commit -m "feat(orca): status/serve API 라우트

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: OrcaPanel UI

**Files:**
- Create: `components/OrcaPanel.tsx`
- Modify: `app/page.tsx`, `package.json`(qrcode.react)

**Interfaces:**
- Consumes: `GET /api/orca/status`, `POST /api/orca/serve`.
- Produces: 대시보드 상단 Orca 패널.

- [ ] **Step 1: qrcode.react 설치**

Run: `npm install qrcode.react`

- [ ] **Step 2: OrcaPanel 컴포넌트 작성**

`components/OrcaPanel.tsx`:
```tsx
'use client'
import { useEffect, useState, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'

interface StatusResp {
  status: { installed: boolean; desktopRunning: boolean; version: string | null; reachable: boolean }
  reachability: { address: string | null; kind: string; allowed: boolean; tailscaleAvailable: boolean }
  serve: { running: boolean; serve: { browserUrl: string | null; mobileUrl: string | null; endpoint: string | null } | null }
  environments: { name: string; endpoint?: string }[]
}

export function OrcaPanel() {
  const [data, setData] = useState<StatusResp | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try { setData(await (await fetch('/api/orca/status')).json()) } catch {}
  }, [])
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t) }, [load])

  async function act(action: 'start' | 'stop') {
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/orca/serve', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const d = await res.json()
      if (!res.ok) setError(d.error ?? '실패')
      await load()
    } catch { setError('네트워크 오류') } finally { setBusy(false) }
  }

  if (!data) return <div className="rounded-xl border p-4 text-sm text-slate-500">Orca 상태 확인 중…</div>
  const { status, reachability, serve, environments } = data
  const running = serve?.running && serve.serve

  return (
    <section className="rounded-xl border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Orca 원격 이어가기</h2>
        <span className={`rounded-full px-2 py-0.5 text-xs ${status.installed ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-600'}`}>
          {status.installed ? `실행 중 · v${status.version ?? '?'}` : 'Orca 미설치'}
        </span>
      </div>

      <p className="mb-2 text-xs text-slate-500">
        도달 주소: {reachability.address ? `${reachability.address} (${reachability.kind})` : 'Tailscale 필요 — README의 F2 참고'}
      </p>

      {running ? (
        <div className="space-y-2">
          <p className="text-sm text-green-700">원격 모드 실행 중</p>
          {serve!.serve!.browserUrl && (
            <div>
              <p className="text-xs font-medium">집 컴퓨터(브라우저)로 접속</p>
              <code className="block break-all text-xs">{serve!.serve!.browserUrl}</code>
              <QRCodeSVG value={serve!.serve!.browserUrl} size={112} className="mt-1" />
            </div>
          )}
          {serve!.serve!.mobileUrl && (
            <div>
              <p className="text-xs font-medium">모바일</p>
              <QRCodeSVG value={serve!.serve!.mobileUrl} size={112} />
            </div>
          )}
          <button onClick={() => act('stop')} disabled={busy}
            className="rounded bg-slate-200 px-3 py-1.5 text-sm">중지</button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-amber-700">
            ⚠ 시작하면 Orca 런타임이 {reachability.kind === 'tailscale' ? 'Tailscale' : '사설망'}에 노출됩니다. 데스크톱 앱을 먼저 닫으세요.
          </p>
          <button onClick={() => act('start')} disabled={busy || status.desktopRunning || !reachability.allowed}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-40">
            {busy ? '시작 중…' : '원격 이어가기 시작'}
          </button>
          {status.desktopRunning && <p className="text-xs text-slate-500">데스크톱 실행 중 — 닫으면 활성화됩니다.</p>}
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {environments.length > 0 && (
        <div className="mt-3 border-t pt-2">
          <p className="text-xs font-medium">저장된 원격 환경</p>
          <ul className="text-xs text-slate-600">
            {environments.map((e) => <li key={e.name}>{e.name}{e.endpoint ? ` · ${e.endpoint}` : ''}</li>)}
          </ul>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 3: 대시보드에 배치**

`app/page.tsx` 상단 import 추가:
```tsx
import { OrcaPanel } from '@/components/OrcaPanel'
```
`<header>` 바로 아래(첫 `<section>` 위)에 삽입:
```tsx
      <div className="mb-6"><OrcaPanel /></div>
```

- [ ] **Step 4: 빌드 + gstack 확인**

Run: `npm run build` — 성공 확인.
`gstack`로 백그라운드 `npm run dev`(3000)에서 `http://localhost:3000` 열어 Orca 패널 렌더 확인: 상태 배지·도달주소·"원격 이어가기 시작" 버튼(데스크톱 실행 중이라 비활성)·경고 문구. **start 제출은 하지 말 것**. 스크린샷. dev 종료.

- [ ] **Step 5: Commit**

```bash
git add components/OrcaPanel.tsx app/page.tsx package.json package-lock.json
git commit -m "feat(orca): 대시보드 Orca 원격 이어가기 패널

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: 문서(F2 런북) + 진행도

**Files:**
- Modify: `README.md`, `project.json`, `.gitignore`

- [ ] **Step 1: README에 "Orca 원격 이어가기" 섹션 + F2 런북**

`README.md`에 섹션 추가: 시나리오(연구실 노트북↔집 Windows), 성립 조건(노트북 켜둠·Tailscale 같은 계정·데스크톱 닫고 원격모드), 사용법("원격 이어가기 시작"→브라우저 URL을 집 Windows에서 열기), **공개 인터넷 노출 금지** 경고. 로드맵 표 F 항목을 "완료"로.

- [ ] **Step 2: .gitignore에 상태 디렉터리 무시(레포 밖이라 사실 불필요하지만 명시)**

`.gitignore`에 한 줄 추가(레포 내 우발 생성 대비):
```
.project-platform/
```

- [ ] **Step 3: project.json 진행도 갱신**

`project.json`의 `progress`를 `50`에서 `70`으로.

- [ ] **Step 4: 최종 확인**

Run: `npm test && npm run build`
Expected: 전체 PASS, 빌드 성공.

- [ ] **Step 5: Commit**

```bash
git add README.md project.json .gitignore
git commit -m "docs(orca): 원격 이어가기 런북과 진행도 갱신

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (계획 검토)

**Spec coverage:**
- 상태 표시: Task 1(statusParse)·4(orcaStatus)·5(API)·6(UI) ✓
- Tailscale 감지: Task 2 ✓
- 원격 이어가기(detached serve 시작/중지): Task 4(serveManager)·5(API)·6(UI) ✓
- 집 Windows 브라우저 URL + 모바일 QR: Task 3(serveParse)·6(QR) ✓
- 저장된 원격환경: Task 1(envParse)·4·5·6 ✓
- 안전(사설주소만·데스크톱닫힘·명시적클릭): Task 4 검증 + 5 매핑 + 6 경고·비활성 ✓
- F2 런북: Task 7 ✓
- 크래시 방지(안전 기본값): Task 1/4 파서·래퍼 ✓

**Placeholder scan:** 모든 코드 단계에 실제 코드. Task 3 Step 5는 사용자 확인 안내(문서), Task 7 README 서술형 — 허용.

**Type consistency:** `OrcaStatus`(installed/desktopRunning/ready/version/reachable), `ServeInfo`(endpoint/browserUrl/mobileUrl), `ServeState`, `Reachability`가 Task 1 정의·이후 사용 일치. `ServeError.code` 값이 Task 4 정의·Task 5 HTTP 매핑 일치. `startServe/stopServe/getServeState` 시그니처 일관. `detectReachability` 반환이 Task 2·5·6 일치.

**리스크 명시:** serveParse 필드명은 관대 추출로 완화하되 Task 3 Step 5에서 사용자 실측 확인. serve 모드 전환 시 진행 중 실행 연속성은 미검증(스펙에 명시).
