import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { parseManifest } from './parseManifest'

let dir: string
beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pm-')) })
afterEach(async () => { await fs.rm(dir, { recursive: true, force: true }) })
const write = (obj: unknown) =>
  fs.writeFile(path.join(dir, 'project.json'),
    typeof obj === 'string' ? obj : JSON.stringify(obj))

describe('parseManifest', () => {
  it('파일 없으면 manifest null, invalid false', async () => {
    expect(await parseManifest(dir)).toEqual({ manifest: null, invalid: false })
  })

  it('정상 매니페스트를 파싱', async () => {
    await write({ description: 'x', status: 'active', progress: 60 })
    const r = await parseManifest(dir)
    expect(r.invalid).toBe(false)
    expect(r.manifest).toMatchObject({ description: 'x', status: 'active', progress: 60 })
  })

  it('깨진 JSON은 invalid true', async () => {
    await write('{ not json')
    expect(await parseManifest(dir)).toEqual({ manifest: null, invalid: true })
  })

  it('status가 허용값 밖이면 invalid true', async () => {
    await write({ status: 'wip' })
    expect(await parseManifest(dir)).toEqual({ manifest: null, invalid: true })
  })

  it('progress가 0~100 밖이면 invalid true', async () => {
    await write({ progress: 150 })
    expect(await parseManifest(dir)).toEqual({ manifest: null, invalid: true })
  })
})
