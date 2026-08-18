import { NextResponse } from 'next/server'
import { scanProjects } from '@/lib/scanner/scanProjects'

export const dynamic = 'force-dynamic'

export async function GET() {
  const projects = await scanProjects()
  return NextResponse.json({ projects })
}
