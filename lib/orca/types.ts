export interface OrcaStatus {
  installed: boolean
  desktopRunning: boolean
  ready: boolean
  version: string | null
  reachable: boolean
}
export interface OrcaEnvironment {
  name: string
  endpoint?: string
  [k: string]: unknown
}
export interface ServeInfo {
  endpoint: string | null
  browserUrl: string | null
  mobileUrl: string | null
}
export type AddressKind = 'tailscale' | 'lan' | 'loopback' | 'public'
export interface Reachability {
  address: string | null
  kind: AddressKind
  allowed: boolean
  tailscaleAvailable: boolean
}
export interface ServeState {
  running: boolean
  pid: number | null
  address: string | null
  serve: ServeInfo | null
  startedAt: number | null
}
