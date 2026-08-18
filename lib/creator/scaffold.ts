import type { Status } from '@/lib/scanner/types'

export function claudeMd(): string {
  return '@AGENTS.md\n'
}

export function agentsMd(name: string, description?: string): string {
  const desc = description && description.trim()
    ? description.trim()
    : '(한 줄로 이 프로젝트가 무엇인지 적으세요)'
  return `# ${name}

${desc}

## 이 프로젝트에서 항상 지킬 것
- 형식 규칙: \`~/Ops/domains/\` 에서 해당하는 것을 참조 (deck / hwp / web / paper)
- (작업하다 "또 이걸 어겼네" 싶은 게 생기면 여기에 한 줄씩 추가하세요)
`
}

export function manifestJson(input: {
  description?: string
  status?: Status
  tags?: string[]
}): string {
  const obj: Record<string, unknown> = {}
  if (input.description && input.description.trim()) obj.description = input.description.trim()
  if (input.status) obj.status = input.status
  if (input.tags && input.tags.length > 0) obj.tags = input.tags
  return JSON.stringify(obj, null, 2) + '\n'
}
