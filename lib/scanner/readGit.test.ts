import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { readGit } from './readGit'

let dir: string
beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rg-')) })
afterEach(async () => { await fs.rm(dir, { recursive: true, force: true }) })

describe('readGit', () => {
  it('git 저장소가 아니면 null', async () => {
    expect(await readGit(dir)).toBeNull()
  })

  it('커밋이 있는 저장소의 정보를 읽는다', async () => {
    const git = (...args: string[]) =>
      execFileSync('git', args, { cwd: dir, stdio: 'pipe' })
    git('init', '-b', 'main')
    git('config', 'user.email', 't@t.com')
    git('config', 'user.name', 'T')
    await fs.writeFile(path.join(dir, 'a.txt'), 'hi')
    git('add', '.')
    git('commit', '-m', 'first')

    const info = await readGit(dir)
    expect(info).not.toBeNull()
    expect(info!.branch).toBe('main')
    expect(info!.commitCount).toBe(1)
    expect(info!.dirty).toBe(false)
    expect(typeof info!.lastCommit).toBe('string')
  })

  it('커밋 안 된 변경이 있으면 dirty true', async () => {
    const git = (...args: string[]) =>
      execFileSync('git', args, { cwd: dir, stdio: 'pipe' })
    git('init', '-b', 'main')
    git('config', 'user.email', 't@t.com')
    git('config', 'user.name', 'T')
    await fs.writeFile(path.join(dir, 'a.txt'), 'hi')
    git('add', '.')
    git('commit', '-m', 'first')
    await fs.writeFile(path.join(dir, 'a.txt'), 'changed')

    const info = await readGit(dir)
    expect(info!.dirty).toBe(true)
  })
})
