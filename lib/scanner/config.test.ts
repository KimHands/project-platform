import { describe, it, expect } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import { ROOTS } from '@/config'

describe('ROOTS', () => {
  it('Projects와 Career 두 루트를 홈 기준으로 정의한다', () => {
    const home = os.homedir()
    expect(ROOTS).toEqual([
      { path: path.join(home, 'Desktop/Projects'), category: 'project' },
      { path: path.join(home, 'Desktop/Career'), category: 'career' },
    ])
  })
})
