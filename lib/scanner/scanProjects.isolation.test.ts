/**
 * scanProjects 격리 테스트
 * buildProjectInfo 전체를 vi.mock으로 교체해 특정 디렉터리에서 throw가 발생해도
 * 나머지 프로젝트가 정상 반환되는지 검증한다.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

vi.mock('./buildProjectInfo', () => ({
  buildProjectInfo: async (dir: string) => {
    if (dir.endsWith('bad')) throw new Error('boom')
    return {
      path: dir,
      folderName: path.basename(dir),
      name: path.basename(dir),
      category: 'project',
      description: '',
      status: 'planning',
      progress: null,
      stack: [],
      runnable: false,
      git: null,
      rules: [],
      hasManifest: false,
      tags: [],
    }
  },
}))

// Import AFTER vi.mock is hoisted
const { scanProjects } = await import('./scanProjects')

let root: string
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'sp-iso-'))
})
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

describe('scanProjects 격리', () => {
  it('한 프로젝트가 스캔 도중 throw해도 나머지는 반환한다', async () => {
    await fs.mkdir(path.join(root, 'good'))
    await fs.mkdir(path.join(root, 'bad'))

    const infos = await scanProjects([{ path: root, category: 'project' }])

    expect(infos.map((i) => i.folderName)).toEqual(['good'])
  })
})
