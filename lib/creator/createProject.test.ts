import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs/promises'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createProject, CreateError } from './createProject'
import { parseManifest } from '@/lib/scanner/parseManifest'

let projRoot: string
let careerRoot: string
let roots: { path: string; category: 'project' | 'career' }[]

beforeEach(async () => {
  projRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'cp-p-'))
  careerRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'cp-c-'))
  roots = [
    { path: projRoot, category: 'project' },
    { path: careerRoot, category: 'career' },
  ]
})
afterEach(async () => {
  await fs.rm(projRoot, { recursive: true, force: true })
  await fs.rm(careerRoot, { recursive: true, force: true })
})

describe('createProject', () => {
  it('골격 3파일을 생성하고 경로를 반환', async () => {
    const res = await createProject(
      { name: 'my-app', category: 'project', description: '데모', status: 'planning', tags: ['x'] },
      roots,
    )
    expect(res.folderName).toBe('my-app')
    expect(res.path).toBe(path.join(projRoot, 'my-app'))
    expect(await fs.readFile(path.join(res.path, 'CLAUDE.md'), 'utf8')).toBe('@AGENTS.md\n')
    expect(await fs.readFile(path.join(res.path, 'AGENTS.md'), 'utf8')).toContain('# my-app')
    const r = await parseManifest(res.path)
    expect(r.invalid).toBe(false)
    expect(r.manifest).toMatchObject({ description: '데모', status: 'planning' })
  })

  it('career 카테고리는 careerRoot 아래에 생성', async () => {
    const res = await createProject({ name: 'road', category: 'career' }, roots)
    expect(res.path).toBe(path.join(careerRoot, 'road'))
  })

  it('잘못된 이름은 CreateError(invalid)', async () => {
    await expect(createProject({ name: 'Bad Name', category: 'project' }, roots))
      .rejects.toMatchObject({ code: 'invalid' })
  })

  it('traversal 이름은 CreateError(invalid)', async () => {
    await expect(createProject({ name: '../evil', category: 'project' }, roots))
      .rejects.toMatchObject({ code: 'invalid' })
  })

  it('이미 존재하면 CreateError(exists), 덮어쓰지 않음', async () => {
    await fs.mkdir(path.join(projRoot, 'dup'))
    await fs.writeFile(path.join(projRoot, 'dup', 'keep.txt'), 'orig')
    await expect(createProject({ name: 'dup', category: 'project' }, roots))
      .rejects.toMatchObject({ code: 'exists' })
    expect(await fs.readFile(path.join(projRoot, 'dup', 'keep.txt'), 'utf8')).toBe('orig')
  })

  it('mkdir EEXIST(경쟁 상황)도 exists로 매핑된다', async () => {
    const err = Object.assign(new Error('EEXIST'), { code: 'EEXIST' })
    const spy = vi.spyOn(fsp, 'mkdir').mockRejectedValueOnce(err)
    await expect(createProject({ name: 'racey', category: 'project' }, roots))
      .rejects.toMatchObject({ code: 'exists' })
    spy.mockRestore()
  })
})
