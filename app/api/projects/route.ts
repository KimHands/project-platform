import { NextResponse } from 'next/server'
import { scanProjects } from '@/lib/scanner/scanProjects'
import { createProject, CreateError } from '@/lib/creator/createProject'

export const dynamic = 'force-dynamic'

export async function GET() {
  const projects = await scanProjects()
  return NextResponse.json({ projects })
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청 본문', code: 'invalid' }, { status: 400 })
  }
  const { name, category, description, status, tags } = (body ?? {}) as Record<string, unknown>
  try {
    const res = await createProject({
      name: String(name ?? ''),
      category: category as 'project' | 'career',
      description: description ? String(description) : undefined,
      status: status as undefined,
      tags: Array.isArray(tags) ? (tags as string[]) : undefined,
    })
    return NextResponse.json(res, { status: 201 })
  } catch (e) {
    if (e instanceof CreateError) {
      const httpStatus = e.code === 'exists' ? 409 : e.code === 'invalid' ? 400 : 500
      return NextResponse.json({ error: e.message, code: e.code }, { status: httpStatus })
    }
    return NextResponse.json({ error: '서버 오류', code: 'server' }, { status: 500 })
  }
}
