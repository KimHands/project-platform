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
