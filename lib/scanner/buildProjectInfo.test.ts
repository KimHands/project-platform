import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { buildProjectInfo, scanProjects } from './scanProjects'

let root: string
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'sp-')) })
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }) })

describe('buildProjectInfo', () => {
  it('매니페스트가 있으면 설명·진행도·상태를 채운다', async () => {
    const dir = path.join(root, 'demo-app')
    await fs.mkdir(dir)
    await fs.writeFile(path.join(dir, 'package.json'),
      JSON.stringify({ dependencies: { next: '15' } }))
    await fs.writeFile(path.join(dir, 'project.json'),
      JSON.stringify({ description: '데모', status: 'active', progress: 40,
        run: { cmd: 'npm run dev' } }))

    const info = await buildProjectInfo(dir, 'project')
    expect(info.folderName).toBe('demo-app')
    expect(info.description).toBe('데모')
    expect(info.progress).toBe(40)
    expect(info.status).toBe('active')
    expect(info.runnable).toBe(true)
    expect(info.hasManifest).toBe(true)
    expect(info.stack.map((s) => s.id).sort()).toEqual(['next', 'node'])
  })

  it('매니페스트가 없으면 progress null, planning, hasManifest false', async () => {
    const dir = path.join(root, 'bare')
    await fs.mkdir(dir)
    const info = await buildProjectInfo(dir, 'career')
    expect(info.progress).toBeNull()
    expect(info.status).toBe('planning')
    expect(info.hasManifest).toBe(false)
    expect(info.runnable).toBe(false)
    expect(info.name).toBe('bare')
  })

  it('매니페스트 stack을 감지 결과와 병합·중복제거', async () => {
    const dir = path.join(root, 'merge')
    await fs.mkdir(dir)
    await fs.writeFile(path.join(dir, 'package.json'),
      JSON.stringify({ dependencies: { next: '15' } }))
    await fs.writeFile(path.join(dir, 'project.json'),
      JSON.stringify({ stack: ['next', 'docker'] }))
    const info = await buildProjectInfo(dir, 'project')
    expect(info.stack.map((s) => s.id).sort()).toEqual(['docker', 'next', 'node'])
  })

  it('매니페스트 run을 ProjectInfo.run으로 전달', async () => {
    const dir = path.join(root, 'runnable')
    await fs.mkdir(dir)
    await fs.writeFile(path.join(dir, 'project.json'),
      JSON.stringify({ run: { cmd: 'npm run dev', port: 3000 } }))
    const info = await buildProjectInfo(dir, 'project')
    expect(info.run).toEqual({ cmd: 'npm run dev', port: 3000 })
    expect(info.runnable).toBe(true)
  })

  it('run 없으면 run은 undefined', async () => {
    const dir = path.join(root, 'bare2')
    await fs.mkdir(dir)
    const info = await buildProjectInfo(dir, 'project')
    expect(info.run).toBeUndefined()
  })
})

describe('scanProjects', () => {
  it('루트 하위 디렉터리만 프로젝트로, 숨김·파일 제외', async () => {
    await fs.mkdir(path.join(root, 'proj-a'))
    await fs.mkdir(path.join(root, '.hidden'))
    await fs.writeFile(path.join(root, '.DS_Store'), 'x')
    const infos = await scanProjects([{ path: root, category: 'project' }])
    expect(infos.map((i) => i.folderName)).toEqual(['proj-a'])
  })

  it('존재하지 않는 루트는 건너뛴다', async () => {
    const infos = await scanProjects([
      { path: path.join(root, 'nope'), category: 'project' },
    ])
    expect(infos).toEqual([])
  })
})
