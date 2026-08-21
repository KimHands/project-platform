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
