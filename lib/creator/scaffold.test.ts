import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { claudeMd, agentsMd, manifestJson } from './scaffold'
import { parseManifest } from '@/lib/scanner/parseManifest'

describe('claudeMd', () => {
  it('첫 줄이 @AGENTS.md', () => {
    expect(claudeMd()).toBe('@AGENTS.md\n')
  })
})

describe('agentsMd', () => {
  it('제목과 설명을 포함', () => {
    const md = agentsMd('my-app', '설명입니다')
    expect(md).toContain('# my-app')
    expect(md).toContain('설명입니다')
    expect(md).toContain('## 이 프로젝트에서 항상 지킬 것')
  })
  it('설명이 없으면 안내 문구', () => {
    const md = agentsMd('my-app')
    expect(md).toContain('# my-app')
    expect(md).toContain('(한 줄로 이 프로젝트가 무엇인지 적으세요)')
  })
})

describe('manifestJson', () => {
  it('parseManifest 라운드트립 시 invalid가 아니다', async () => {
    const json = manifestJson({ description: 'x', status: 'planning', tags: ['a'] })
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-'))
    try {
      await fs.writeFile(path.join(dir, 'project.json'), json)
      const r = await parseManifest(dir)
      expect(r.invalid).toBe(false)
      expect(r.manifest).toMatchObject({ description: 'x', status: 'planning' })
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
  it('빈 값은 생략한다', () => {
    const json = manifestJson({ description: '', status: 'planning' })
    const obj = JSON.parse(json)
    expect(obj.description).toBeUndefined()
    expect('tags' in obj).toBe(false)
    expect(obj.status).toBe('planning')
  })
})
