import path from 'node:path'
import type { Category, ProjectInfo, StackItem, Status } from './types'
import { detectStack, STACK_REGISTRY } from './detectStack'
import { parseManifest } from './parseManifest'
import { readGit } from './readGit'
import { checkRules } from './checkRules'

function mergeStack(detected: StackItem[], manifestIds?: string[]): StackItem[] {
  const map = new Map<string, StackItem>()
  for (const s of detected) map.set(s.id, s)
  for (const id of manifestIds ?? []) {
    if (!map.has(id)) {
      map.set(id, STACK_REGISTRY[id] ?? { id, label: id, icon: 'dot' })
    }
  }
  return [...map.values()]
}

function deriveStatus(explicit: Status | undefined, git: { lastCommit: string } | null): Status {
  if (explicit) return explicit
  if (!git) return 'planning'
  return /year|month/.test(git.lastCommit) ? 'paused' : 'active'
}

export async function buildProjectInfo(
  dir: string,
  category: Category,
): Promise<ProjectInfo> {
  const folderName = path.basename(dir)
  const [detected, { manifest, invalid }, git] = await Promise.all([
    detectStack(dir),
    parseManifest(dir),
    readGit(dir),
  ])
  const rules = await checkRules(dir, folderName, invalid)

  return {
    path: dir,
    folderName,
    name: folderName,
    category,
    description: manifest?.description ?? '',
    status: deriveStatus(manifest?.status, git),
    progress: manifest?.progress ?? null,
    stack: mergeStack(detected, manifest?.stack),
    runnable: Boolean(manifest?.run?.cmd),
    git,
    rules,
    hasManifest: manifest !== null,
    tags: manifest?.tags ?? [],
  }
}
