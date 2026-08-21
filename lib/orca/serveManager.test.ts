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
