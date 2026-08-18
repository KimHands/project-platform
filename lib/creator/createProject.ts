import fs from 'node:fs/promises'
import path from 'node:path'
import { ROOTS, type Root } from '@/config'
import { validateNewProject, type NewProjectInput } from './validateNewProject'
import { claudeMd, agentsMd, manifestJson } from './scaffold'

export class CreateError extends Error {
  code: 'invalid' | 'exists' | 'server'
  constructor(code: 'invalid' | 'exists' | 'server', message: string) {
    super(message)
    this.code = code
    this.name = 'CreateError'
  }
}

async function exists(p: string): Promise<boolean> {
  try { await fs.access(p); return true } catch { return false }
}

export async function createProject(
  input: NewProjectInput,
  roots: Root[] = ROOTS,
): Promise<{ path: string; folderName: string }> {
  const { ok, errors } = validateNewProject(input)
  if (!ok) throw new CreateError('invalid', errors.join(' '))

  const root = roots.find((r) => r.category === input.category)
  if (!root) throw new CreateError('invalid', '카테고리에 해당하는 루트가 없습니다.')

  const target = path.join(root.path, input.name)
  // 방어 심층화: 정규화된 경로가 root 바로 아래인지 재검증
  const rootResolved = path.resolve(root.path)
  const targetResolved = path.resolve(target)
  if (path.dirname(targetResolved) !== rootResolved) {
    throw new CreateError('invalid', '허용되지 않은 경로입니다.')
  }

  if (await exists(target)) {
    throw new CreateError('exists', '같은 이름의 폴더가 이미 있습니다.')
  }

  try {
    await fs.mkdir(target, { recursive: false })
    await fs.writeFile(path.join(target, 'CLAUDE.md'), claudeMd())
    await fs.writeFile(path.join(target, 'AGENTS.md'), agentsMd(input.name, input.description))
    await fs.writeFile(
      path.join(target, 'project.json'),
      manifestJson({ description: input.description, status: input.status, tags: input.tags }),
    )
  } catch (e) {
    if ((e as NodeJS.ErrnoException)?.code === 'EEXIST') {
      throw new CreateError('exists', '같은 이름의 폴더가 이미 있습니다.')
    }
    throw new CreateError('server', `생성 실패: ${(e as Error).message}`)
  }

  return { path: target, folderName: input.name }
}
