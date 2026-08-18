import fs from 'node:fs/promises'
import path from 'node:path'
import type { RuleViolation } from './types'
import { FOLDER_RE } from '@/lib/rules'

async function readFileOrNull(p: string): Promise<string | null> {
  try { return await fs.readFile(p, 'utf8') } catch { return null }
}

export async function checkRules(
  dir: string,
  folderName: string,
  manifestInvalid: boolean,
): Promise<RuleViolation[]> {
  const rules: RuleViolation[] = []

  if (!FOLDER_RE.test(folderName)) {
    rules.push({
      id: 'folder-name-format',
      level: 'error',
      message: '폴더명은 ASCII 소문자·숫자·하이픈만 허용됩니다.',
    })
  }

  const claude = await readFileOrNull(path.join(dir, 'CLAUDE.md'))
  if (claude === null) {
    rules.push({
      id: 'claudemd-exists',
      level: 'warn',
      message: 'CLAUDE.md가 없어 프로젝트 규칙이 주입되지 않습니다.',
    })
  } else if (claude.split('\n')[0].trim() !== '@AGENTS.md') {
    rules.push({
      id: 'claudemd-first-line',
      level: 'warn',
      message: 'CLAUDE.md 첫 줄은 @AGENTS.md 여야 합니다.',
    })
  }

  const agents = await readFileOrNull(path.join(dir, 'AGENTS.md'))
  if (agents === null) {
    rules.push({
      id: 'agentsmd-exists',
      level: 'warn',
      message: 'AGENTS.md가 없습니다.',
    })
  }

  if (manifestInvalid) {
    rules.push({
      id: 'manifest-invalid',
      level: 'warn',
      message: 'project.json이 손상되었거나 스키마에 맞지 않습니다.',
    })
  }

  return rules
}
