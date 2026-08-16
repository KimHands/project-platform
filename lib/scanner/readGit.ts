import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { GitInfo } from './types'

const run = promisify(execFile)

async function git(dir: string, args: string[]): Promise<string> {
  const { stdout } = await run('git', args, { cwd: dir })
  return stdout.trim()
}

export async function readGit(dir: string): Promise<GitInfo | null> {
  try {
    await fs.access(path.join(dir, '.git'))
  } catch {
    return null
  }
  try {
    const branch = await git(dir, ['rev-parse', '--abbrev-ref', 'HEAD'])
    const lastCommit = await git(dir, ['log', '-1', '--format=%cr'])
    const countStr = await git(dir, ['rev-list', '--count', 'HEAD'])
    const status = await git(dir, ['status', '--porcelain'])
    return {
      branch,
      lastCommit,
      commitCount: parseInt(countStr, 10) || 0,
      dirty: status.length > 0,
    }
  } catch {
    return null
  }
}
