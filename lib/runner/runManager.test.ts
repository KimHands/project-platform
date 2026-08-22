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

  // 경로 탐색 방어 테스트
  it('getRunState: ../가 포함된 folderName은 running:false 반환 (경로 탐색 차단)', async () => {
    const { deps } = makeDeps()
    const st = await getRunState('../../evil', deps)
    expect(st.running).toBe(false)
    expect(st.folderName).toBe('../../evil')
  })

  it('tailLog: ../가 포함된 folderName은 빈 문자열 반환 (경로 탐색 차단)', async () => {
    const { deps } = makeDeps()
    const result = await tailLog('../../evil', 200, deps)
    expect(result).toBe('')
  })

  it('stopRun: ../가 포함된 folderName은 kill 없이 stopped 반환 (경로 탐색 차단)', async () => {
    const { deps, killed } = makeDeps()
    const st = await stopRun('../../evil', deps)
    expect(st.running).toBe(false)
    expect(killed).toHaveLength(0)
  })
})
