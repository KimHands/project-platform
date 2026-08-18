import { describe, it, expect } from 'vitest'
import { validateNewProject } from './validateNewProject'

const base = { name: 'my-app', category: 'project' as const }

describe('validateNewProject', () => {
  it('정상 입력은 ok', () => {
    expect(validateNewProject(base)).toEqual({ ok: true, errors: [] })
  })
  it('대문자 이름 거부', () => {
    const r = validateNewProject({ ...base, name: 'MyApp' })
    expect(r.ok).toBe(false)
    expect(r.errors.join()).toContain('폴더명')
  })
  it('한글 이름 거부', () => {
    expect(validateNewProject({ ...base, name: '프로젝트' }).ok).toBe(false)
  })
  it('슬래시/경로 이름 거부', () => {
    expect(validateNewProject({ ...base, name: 'a/b' }).ok).toBe(false)
    expect(validateNewProject({ ...base, name: '..' }).ok).toBe(false)
    expect(validateNewProject({ ...base, name: 'a b' }).ok).toBe(false)
  })
  it('빈 이름 거부', () => {
    expect(validateNewProject({ ...base, name: '' }).ok).toBe(false)
  })
  it('잘못된 카테고리 거부', () => {
    const r = validateNewProject({ name: 'ok', category: 'wrong' as never })
    expect(r.ok).toBe(false)
    expect(r.errors.join()).toContain('카테고리')
  })
})
