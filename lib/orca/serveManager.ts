import { spawn as realSpawn } from 'node:child_process'
import { readFile, writeFile, rm, mkdir } from 'node:fs/promises'
import { openSync, closeSync, mkdirSync } from 'node:fs'
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
  mkdirSync(DIR, { recursive: true })
  const fd = openSync(logPath, 'w')
  const child = realSpawn('orca', ['serve', '--pairing-address', addr, '--mobile-pairing', '--json'],
    { detached: true, stdio: ['ignore', fd, fd] })
  closeSync(fd)
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
    sleep: deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms))),
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
