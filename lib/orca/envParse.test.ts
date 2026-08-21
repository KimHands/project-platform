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
