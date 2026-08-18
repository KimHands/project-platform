import fs from 'node:fs/promises'
import path from 'node:path'
import type { Manifest, Status } from './types'

const STATUSES: Status[] = ['planning', 'active', 'paused', 'done']

function validate(raw: unknown): Manifest | null {
  if (typeof raw !== 'object' || raw === null) return null
  const o = raw as Record<string, unknown>
  if (o.status !== undefined && !STATUSES.includes(o.status as Status)) return null
  if (o.progress !== undefined) {
    if (typeof o.progress !== 'number' || o.progress < 0 || o.progress > 100) return null
  }
  if (o.description !== undefined && typeof o.description !== 'string') return null
  if (o.stack !== undefined && !Array.isArray(o.stack)) return null
  if (o.tags !== undefined && !Array.isArray(o.tags)) return null
  if (o.run !== undefined) {
    const run = o.run as Record<string, unknown>
    if (typeof run?.cmd !== 'string') return null
  }
  return o as Manifest
}

export async function parseManifest(
  dir: string,
): Promise<{ manifest: Manifest | null; invalid: boolean }> {
  const p = path.join(dir, 'project.json')
  let text: string
  try {
    text = await fs.readFile(p, 'utf8')
  } catch {
    return { manifest: null, invalid: false }
  }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { manifest: null, invalid: true }
  }
  const manifest = validate(raw)
  if (manifest === null) return { manifest: null, invalid: true }
  return { manifest, invalid: false }
}
