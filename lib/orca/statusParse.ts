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
