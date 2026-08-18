import { describe, it, expect } from 'vitest'
import { renderPlist } from './render-plist.mjs'

const base = {
  label: 'com.kimjonggun.project-platform',
  nodeBin: '/opt/homebrew/bin',
  appDir: '/Users/kim/Desktop/Projects/project-platform',
  port: 4319,
  logDir: '/Users/kim/Library/Logs/project-platform',
}

describe('renderPlist', () => {
  it('Label과 run.sh ProgramArguments를 포함한다', () => {
    const xml = renderPlist(base)
    expect(xml).toContain('<string>com.kimjonggun.project-platform</string>')
    expect(xml).toContain('<string>/bin/bash</string>')
    expect(xml).toContain(`<string>${base.appDir}/scripts/autostart/run.sh</string>`)
  })

  it('PORT·PATH·WorkingDirectory·RunAtLoad·KeepAlive·ThrottleInterval을 담는다', () => {
    const xml = renderPlist(base)
    expect(xml).toContain('<key>PORT</key>')
    expect(xml).toContain('<string>4319</string>')
    expect(xml).toContain('/opt/homebrew/bin:/usr/bin:/bin')
    expect(xml).toContain(`<key>WorkingDirectory</key>`)
    expect(xml).toContain(`<string>${base.appDir}</string>`)
    expect(xml).toMatch(/<key>RunAtLoad<\/key>\s*<true\/>/)
    expect(xml).toMatch(/<key>KeepAlive<\/key>\s*<true\/>/)
    expect(xml).toMatch(/<key>ThrottleInterval<\/key>\s*<integer>10<\/integer>/)
  })

  it('로그 경로를 StandardOutPath/StandardErrorPath에 넣는다', () => {
    const xml = renderPlist(base)
    expect(xml).toContain(`<string>${base.logDir}/out.log</string>`)
    expect(xml).toContain(`<string>${base.logDir}/err.log</string>`)
  })

  it('appDir의 & 문자를 XML 이스케이프한다', () => {
    const xml = renderPlist({ ...base, appDir: '/Users/kim/a & b/proj' })
    expect(xml).toContain('/Users/kim/a &amp; b/proj')
    expect(xml).not.toContain('/Users/kim/a & b/proj')
  })

  it('유효한 plist 헤더로 시작한다', () => {
    const xml = renderPlist(base)
    expect(xml.startsWith('<?xml')).toBe(true)
    expect(xml).toContain('<!DOCTYPE plist')
  })
})
