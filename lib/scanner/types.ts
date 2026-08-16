export type Category = 'project' | 'career'
export type Status = 'planning' | 'active' | 'paused' | 'done'

export interface StackItem { id: string; label: string; icon: string }
export interface RunConfig { cmd: string; port?: number }

export interface Manifest {
  description?: string
  status?: Status
  progress?: number
  run?: RunConfig
  stack?: string[]
  tags?: string[]
}

export interface GitInfo {
  branch: string
  lastCommit: string // 상대시간 문자열 (예: "3 days ago")
  dirty: boolean
  commitCount: number
}

export interface RuleViolation {
  id: string
  level: 'error' | 'warn'
  message: string
}

export interface ProjectInfo {
  path: string
  folderName: string
  name: string
  category: Category
  description: string
  status: Status
  progress: number | null
  stack: StackItem[]
  runnable: boolean
  git: GitInfo | null
  rules: RuleViolation[]
  hasManifest: boolean
  tags: string[]
}
