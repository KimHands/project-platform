import type { RuleViolation } from '@/lib/scanner/types'

export function countErrors(rules: RuleViolation[]): number {
  return rules.filter((r) => r.level === 'error').length
}
export function countWarns(rules: RuleViolation[]): number {
  return rules.filter((r) => r.level === 'warn').length
}
