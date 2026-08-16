import { notFound } from 'next/navigation'
import Link from 'next/link'
import { scanProjects } from '@/lib/scanner/scanProjects'
import { StatusBadge } from '@/components/StatusBadge'
import { StackIcons } from '@/components/StackIcons'

export const dynamic = 'force-dynamic'

export default async function ProjectDetail(
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params
  const projects = await scanProjects()
  const p = projects.find((x) => x.folderName === decodeURIComponent(name))
  if (!p) notFound()

  return (
    <main className="mx-auto max-w-3xl p-8">
      <Link href="/" className="text-sm text-slate-500 hover:underline">← 대시보드</Link>
      <div className="mt-3 mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-bold">{p.name}</h1>
        <StatusBadge status={p.status} />
      </div>
      <p className="mb-4 text-sm text-slate-500">{p.path}</p>
      {p.description && <p className="mb-6">{p.description}</p>}

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">기술 스택</h2>
        <StackIcons stack={p.stack} />
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">진행도</h2>
        <p>{p.progress === null ? '— (매니페스트에 progress 없음)' : `${p.progress}%`}</p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">Git</h2>
        {p.git ? (
          <ul className="text-sm text-slate-700">
            <li>브랜치: {p.git.branch}</li>
            <li>최근 커밋: {p.git.lastCommit}</li>
            <li>커밋 수: {p.git.commitCount}</li>
            <li>변경사항: {p.git.dirty ? '있음(dirty)' : '없음'}</li>
          </ul>
        ) : <p className="text-sm text-slate-500">git 저장소 아님</p>}
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">실행</h2>
        {p.runnable ? (
          <button disabled
            className="cursor-not-allowed rounded bg-slate-200 px-3 py-1.5 text-sm text-slate-500">
            동작 (곧 지원)
          </button>
        ) : <p className="text-sm text-slate-500">실행 명령 미정의</p>}
      </section>

      <section>
        <h2 className="mb-2 font-semibold">규칙 검사</h2>
        {p.rules.length === 0 ? (
          <p className="text-sm text-green-700">위반 없음 ✓</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {p.rules.map((r) => (
              <li key={r.id}>
                <span className={r.level === 'error' ? 'text-red-600' : 'text-amber-600'}>
                  [{r.level}]
                </span>{' '}
                {r.message}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
