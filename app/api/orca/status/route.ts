import { NextResponse } from 'next/server'
import { orcaStatus, orcaEnvironments } from '@/lib/orca/orcaCli'
import { detectReachability } from '@/lib/orca/reachability'
import { getServeState } from '@/lib/orca/serveManager'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [status, environments, reachability, serve] = await Promise.all([
    orcaStatus(), orcaEnvironments(), detectReachability(), getServeState(),
  ])
  return NextResponse.json({ status, environments, reachability, serve })
}
