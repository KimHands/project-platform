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
