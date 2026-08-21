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
