import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { statusParse } from './statusParse'
import { envParse } from './envParse'
import type { OrcaStatus, OrcaEnvironment } from './types'

const run = promisify(execFile)

export async function orcaStatus(): Promise<OrcaStatus> {
  try {
    const { stdout } = await run('orca', ['status', '--json'])
    return statusParse(stdout)
  } catch {
    return { installed: false, desktopRunning: false, ready: false, version: null, reachable: false }
  }
}

export async function orcaEnvironments(): Promise<OrcaEnvironment[]> {
  try {
    const { stdout } = await run('orca', ['environment', 'list', '--json'])
    return envParse(stdout)
  } catch {
    return []
  }
}
