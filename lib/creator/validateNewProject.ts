import { FOLDER_RE } from '@/lib/rules'
import type { Category, Status } from '@/lib/scanner/types'

export interface NewProjectInput {
  name: string
  category: Category
  description?: string
  status?: Status
  tags?: string[]
}

const CATEGORIES: Category[] = ['project', 'career']

export function validateNewProject(
  input: NewProjectInput,
): { ok: boolean; errors: string[] } {
  const errors: string[] = []
  if (!FOLDER_RE.test(input.name)) {
    errors.push('폴더명은 ASCII 소문자·숫자·하이픈만 허용됩니다.')
  }
  if (!CATEGORIES.includes(input.category)) {
    errors.push('카테고리는 project 또는 career여야 합니다.')
  }
  return { ok: errors.length === 0, errors }
}
