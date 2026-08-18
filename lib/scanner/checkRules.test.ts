import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { checkRules } from './checkRules'

let dir: string
beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cr-')) })
afterEach(async () => { await fs.rm(dir, { recursive: true, force: true }) })
const ids = (rs: { id: string }[]) => rs.map((r) => r.id).sort()

describe('checkRules', () => {
  it('규칙에 맞는 폴더는 위반 없음', async () => {
    await fs.writeFile(path.join(dir, 'CLAUDE.md'), '@AGENTS.md\n')
    await fs.writeFile(path.join(dir, 'AGENTS.md'), '# x\n')
    const rules = await checkRules(dir, 'my-project', false)
    expect(rules).toEqual([])
  })

  it('폴더명에 대문자/한글이 있으면 folder-name-format error', async () => {
    await fs.writeFile(path.join(dir, 'CLAUDE.md'), '@AGENTS.md\n')
    await fs.writeFile(path.join(dir, 'AGENTS.md'), '# x\n')
    const rules = await checkRules(dir, 'My_프로젝트', false)
    const r = rules.find((x) => x.id === 'folder-name-format')
    expect(r?.level).toBe('error')
  })

  it('CLAUDE.md 없으면 claudemd-exists warn', async () => {
    await fs.writeFile(path.join(dir, 'AGENTS.md'), '# x\n')
    expect(ids(await checkRules(dir, 'ok', false))).toContain('claudemd-exists')
  })

  it('CLAUDE.md 첫 줄이 @AGENTS.md 아니면 claudemd-first-line warn', async () => {
    await fs.writeFile(path.join(dir, 'CLAUDE.md'), '# hello\n')
    await fs.writeFile(path.join(dir, 'AGENTS.md'), '# x\n')
    expect(ids(await checkRules(dir, 'ok', false))).toContain('claudemd-first-line')
  })

  it('AGENTS.md 없으면 agentsmd-exists warn', async () => {
    await fs.writeFile(path.join(dir, 'CLAUDE.md'), '@AGENTS.md\n')
    expect(ids(await checkRules(dir, 'ok', false))).toContain('agentsmd-exists')
  })

  it('manifestInvalid면 manifest-invalid warn', async () => {
    await fs.writeFile(path.join(dir, 'CLAUDE.md'), '@AGENTS.md\n')
    await fs.writeFile(path.join(dir, 'AGENTS.md'), '# x\n')
    expect(ids(await checkRules(dir, 'ok', true))).toContain('manifest-invalid')
  })
})
