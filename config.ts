import os from 'node:os'
import path from 'node:path'
import type { Category } from '@/lib/scanner/types'

export interface Root { path: string; category: Category }

export const ROOTS: Root[] = [
  { path: path.join(os.homedir(), 'Desktop/Projects'), category: 'project' },
  { path: path.join(os.homedir(), 'Desktop/Career'), category: 'career' },
]
