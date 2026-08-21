import { NextResponse } from 'next/server'
import { startRun, stopRun, getRunState } from '@/lib/runner/runManager'
import { RunError } from '@/lib/runner/resolveRun'

export const dynamic = 'force-dynamic'

function codeToStatus(code: RunError['code']): number {
  return code === 'not-found' ? 404 : code === 'server' ? 500 : 400
}

export async function GET(request: Request) {
  const name = new URL(request.url).searchParams.get('folderName') ?? ''
  return NextResponse.json(await getRunState(name))
}

export async function POST(request: Request) {
  let body: { folderName?: string; action?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: '잘못된 본문', code: 'invalid' }, { status: 400 }) }
  const folderName = String(body.folderName ?? '')
  try {
    if (body.action === 'stop') return NextResponse.json(await stopRun(folderName))
    if (body.action !== 'start') return NextResponse.json({ error: 'action은 start|stop', code: 'invalid' }, { status: 400 })
    return NextResponse.json(await startRun(folderName))
  } catch (e) {
    if (e instanceof RunError) return NextResponse.json({ error: e.message, code: e.code }, { status: codeToStatus(e.code) })
    return NextResponse.json({ error: '서버 오류', code: 'server' }, { status: 500 })
  }
}
