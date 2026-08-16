import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { detectStack } from './detectStack'

let dir: string
beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ds-')) })
afterEach(async () => { await fs.rm(dir, { recursive: true, force: true }) })

const ids = (items: { id: string }[]) => items.map((i) => i.id).sort()

describe('detectStack', () => {
  it('마커가 없으면 빈 배열', async () => {
    expect(await detectStack(dir)).toEqual([])
  })

  it('package.json + next 의존성이면 node와 next를 감지', async () => {
    await fs.writeFile(
      path.join(dir, 'package.json'),
      JSON.stringify({ dependencies: { next: '15.0.0', react: '19.0.0' } }),
    )
    expect(ids(await detectStack(dir))).toEqual(['next', 'node', 'react'])
  })

  it('requirements.txt면 python', async () => {
    await fs.writeFile(path.join(dir, 'requirements.txt'), 'flask\n')
    expect(ids(await detectStack(dir))).toEqual(['python'])
  })

  it('go.mod면 go', async () => {
    await fs.writeFile(path.join(dir, 'go.mod'), 'module x\n')
    expect(ids(await detectStack(dir))).toEqual(['go'])
  })

  it('Dockerfile은 다른 스택에 추가로 감지', async () => {
    await fs.writeFile(path.join(dir, 'go.mod'), 'module x\n')
    await fs.writeFile(path.join(dir, 'Dockerfile'), 'FROM alpine\n')
    expect(ids(await detectStack(dir))).toEqual(['docker', 'go'])
  })

  it('아무 마커 없이 index.html만 있으면 static', async () => {
    await fs.writeFile(path.join(dir, 'index.html'), '<html></html>')
    expect(ids(await detectStack(dir))).toEqual(['static'])
  })
})
