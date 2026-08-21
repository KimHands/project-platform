import type { OrcaEnvironment } from './types'

export function envParse(jsonText: string): OrcaEnvironment[] {
  let d: unknown
  try { d = JSON.parse(jsonText) } catch { return [] }
  const envs = (d as { result?: { environments?: unknown } })?.result?.environments
  if (!Array.isArray(envs)) return []
  return envs.filter((e): e is OrcaEnvironment =>
    typeof e === 'object' && e !== null && typeof (e as { name?: unknown }).name === 'string')
}
