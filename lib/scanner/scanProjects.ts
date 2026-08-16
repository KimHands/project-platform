import fs from 'node:fs/promises'
import path from 'node:path'
import type { ProjectInfo } from './types'
import { ROOTS, type Root } from '@/config'
import { buildProjectInfo } from './buildProjectInfo'

export { buildProjectInfo }

export async function scanProjects(roots: Root[] = ROOTS): Promise<ProjectInfo[]> {
  const all: ProjectInfo[] = []
  for (const root of roots) {
    let entries
    try {
      entries = await fs.readdir(root.path, { withFileTypes: true })
    } catch {
      continue
    }
    const dirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    const infos = await Promise.all(
      dirs.map((e) => buildProjectInfo(path.join(root.path, e.name), root.category)),
    )
    all.push(...infos)
  }
  return all
}
