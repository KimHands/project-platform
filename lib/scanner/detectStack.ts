import fs from 'node:fs/promises'
import path from 'node:path'
import type { StackItem } from './types'

export const STACK_REGISTRY: Record<string, StackItem> = {
  node: { id: 'node', label: 'Node.js', icon: 'nodedotjs' },
  next: { id: 'next', label: 'Next.js', icon: 'nextdotjs' },
  react: { id: 'react', label: 'React', icon: 'react' },
  vue: { id: 'vue', label: 'Vue', icon: 'vuedotjs' },
  express: { id: 'express', label: 'Express', icon: 'express' },
  python: { id: 'python', label: 'Python', icon: 'python' },
  go: { id: 'go', label: 'Go', icon: 'go' },
  rust: { id: 'rust', label: 'Rust', icon: 'rust' },
  java: { id: 'java', label: 'Java', icon: 'openjdk' },
  docker: { id: 'docker', label: 'Docker', icon: 'docker' },
  static: { id: 'static', label: 'Static Web', icon: 'html5' },
}

async function exists(p: string): Promise<boolean> {
  try { await fs.access(p); return true } catch { return false }
}

async function readJson(p: string): Promise<Record<string, unknown> | null> {
  try { return JSON.parse(await fs.readFile(p, 'utf8')) } catch { return null }
}

export async function detectStack(dir: string): Promise<StackItem[]> {
  const found = new Set<string>()

  const pkgPath = path.join(dir, 'package.json')
  if (await exists(pkgPath)) {
    found.add('node')
    const pkg = await readJson(pkgPath)
    const deps = {
      ...(pkg?.dependencies as object),
      ...(pkg?.devDependencies as object),
    } as Record<string, string>
    if (deps.next) found.add('next')
    if (deps.react) found.add('react')
    if (deps.vue) found.add('vue')
    if (deps.express) found.add('express')
  }

  if ((await exists(path.join(dir, 'requirements.txt'))) ||
      (await exists(path.join(dir, 'pyproject.toml')))) found.add('python')
  if (await exists(path.join(dir, 'go.mod'))) found.add('go')
  if (await exists(path.join(dir, 'Cargo.toml'))) found.add('rust')
  if ((await exists(path.join(dir, 'pom.xml'))) ||
      (await exists(path.join(dir, 'build.gradle')))) found.add('java')
  if (await exists(path.join(dir, 'Dockerfile'))) found.add('docker')

  if (found.size === 0 && (await exists(path.join(dir, 'index.html')))) {
    found.add('static')
  }

  return [...found].map((id) => STACK_REGISTRY[id])
}
