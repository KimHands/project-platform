import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { resolveRun, RunError } from './resolveRun'

let projRoot: string
let roots: { path: string; category: 'project' | 'career' }[]
beforeEach(async () => {
  projRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'rr-'))
  roots = [{ path: projRoot, category: 'project' }]
})
afterEach(async () => { await fs.rm(projRoot, { recursive: true, force: true }) })

describe('resolveRun', () => {
  it('run.cmd 있으면 경로·cmd·port 반환', async () => {
    const dir = path.join(projRoot, 'app1')
    await fs.mkdir(dir)
    await fs.writeFile(path.join(dir, 'project.json'),
      JSON.stringify({ run: { cmd: 'npm run dev', port: 3000 } }))
    expect(await resolveRun('app1', roots)).toEqual({
      projectPath: dir, cmd: 'npm run dev', port: 3000,
    })
  })
  it('port 없으면 null', async () => {
    const dir = path.join(projRoot, 'app2')
    await fs.mkdir(dir)
    await fs.writeFile(path.join(dir, 'project.json'), JSON.stringify({ run: { cmd: 'python app.py' } }))
    expect((await resolveRun('app2', roots)).port).toBeNull()
  })
  it('잘못된 이름 → invalid', async () => {
    await expect(resolveRun('Bad Name', roots)).rejects.toMatchObject({ code: 'invalid' })
    await expect(resolveRun('../evil', roots)).rejects.toMatchObject({ code: 'invalid' })
  })
  it('없는 폴더 → not-found', async () => {
    await expect(resolveRun('nope', roots)).rejects.toMatchObject({ code: 'not-found' })
  })
  it('run.cmd 없으면 → not-runnable', async () => {
    const dir = path.join(projRoot, 'app3')
    await fs.mkdir(dir)
    await fs.writeFile(path.join(dir, 'project.json'), JSON.stringify({ description: 'x' }))
    await expect(resolveRun('app3', roots)).rejects.toMatchObject({ code: 'not-runnable' })
  })
})
