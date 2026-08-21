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
