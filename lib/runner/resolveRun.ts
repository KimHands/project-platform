import fs from 'node:fs/promises'
import path from 'node:path'
import { FOLDER_RE } from '@/lib/rules'
import { parseManifest } from '@/lib/scanner/parseManifest'
import { ROOTS, type Root } from '@/config'

export interface RunTarget { projectPath: string; cmd: string; port: number | null }

export class RunError extends Error {
  code: 'invalid' | 'not-found' | 'not-runnable' | 'server'
  constructor(code: RunError['code'], message: string) {
    super(message); this.code = code; this.name = 'RunError'
  }
}

async function exists(p: string): Promise<boolean> {
  try { await fs.access(p); return true } catch { return false }
}

export async function resolveRun(folderName: string, roots: Root[] = ROOTS): Promise<RunTarget> {
  if (!FOLDER_RE.test(folderName)) throw new RunError('invalid', '잘못된 폴더명입니다.')

  for (const root of roots) {
    const target = path.join(root.path, folderName)
    if (path.dirname(path.resolve(target)) !== path.resolve(root.path)) continue
    if (!(await exists(target))) continue
    const { manifest } = await parseManifest(target)
    if (!manifest?.run?.cmd) throw new RunError('not-runnable', '실행 명령이 없습니다.')
    return { projectPath: target, cmd: manifest.run.cmd, port: manifest.run.port ?? null }
  }
  throw new RunError('not-found', '프로젝트를 찾을 수 없습니다.')
}
