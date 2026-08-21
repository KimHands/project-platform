import { NextResponse } from 'next/server'
import { tailLog } from '@/lib/runner/runManager'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const name = new URL(request.url).searchParams.get('folderName') ?? ''
  return NextResponse.json({ log: await tailLog(name) })
}
