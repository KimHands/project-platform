import { NextResponse } from 'next/server'
import { startServe, stopServe, ServeError } from '@/lib/orca/serveManager'
import { detectReachability } from '@/lib/orca/reachability'
import { orcaStatus } from '@/lib/orca/orcaCli'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let body: { action?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: '잘못된 본문', code: 'invalid' }, { status: 400 }) }

  if (body.action === 'stop') {
    return NextResponse.json(await stopServe())
  }
  if (body.action !== 'start') {
    return NextResponse.json({ error: 'action은 start|stop', code: 'invalid' }, { status: 400 })
  }
  const status = await orcaStatus()
  if (!status.installed) return NextResponse.json({ error: 'Orca 미설치', code: 'orca-missing' }, { status: 400 })
  const reach = await detectReachability()
  if (!reach.allowed || !reach.address) {
    return NextResponse.json({ error: 'Tailscale 등 사설 주소가 필요합니다.', code: 'unreachable' }, { status: 400 })
  }
  try {
    const state = await startServe(reach.address)
    return NextResponse.json(state, { status: 200 })
  } catch (e) {
    if (e instanceof ServeError) {
      const s = e.code === 'desktop-running' ? 409 : 400
      return NextResponse.json({ error: e.message, code: e.code }, { status: s })
    }
    return NextResponse.json({ error: '서버 오류', code: 'server' }, { status: 500 })
  }
}
