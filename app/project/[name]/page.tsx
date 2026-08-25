import { notFound } from 'next/navigation'
import Link from 'next/link'
import { scanProjects } from '@/lib/scanner/scanProjects'
import { StatusBadge } from '@/components/StatusBadge'
import { StackIcons } from '@/components/StackIcons'
import { RunControls } from '@/components/RunControls'

export const dynamic = 'force-dynamic'

export default async function ProjectDetail(
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params
  const projects = await scanProjects()
  const p = projects.find((x) => x.folderName === decodeURIComponent(name))
  if (!p) notFound()

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/" className="text-dim text-sm hover:text-white">← 대시보드</Link>
      <div className="mt-3 mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-white">{p.name}</h1>
        <StatusBadge status={p.status} />
      </div>
      <p className="mb-4 text-faint font-mono text-sm">{p.path}</p>
      {p.description && <p className="mb-6 text-dim">{p.description}</p>}

      <section className="glass mb-4 rounded-2xl p-5">
        <h2 className="text-dim mb-3 text-sm font-semibold uppercase tracking-widest">기술 스택</h2>
        <StackIcons stack={p.stack} />
      </section>

      <section className="glass mb-4 rounded-2xl p-5">
        <h2 className="text-dim mb-3 text-sm font-semibold uppercase tracking-widest">진행도</h2>
        <p className="text-dim text-sm">{p.progress === null ? '— (매니페스트에 progress 없음)' : `${p.progress}%`}</p>
      </section>

      <section className="glass mb-4 rounded-2xl p-5">
        <h2 className="text-dim mb-3 text-sm font-semibold uppercase tracking-widest">Git</h2>
        {p.git ? (
          <ul className="text-dim text-sm">
            <li>브랜치: <span className="font-mono">{p.git.branch}</span></li>
            <li>최근 커밋: <span className="font-mono">{p.git.lastCommit}</span></li>
            <li>커밋 수: <span className="font-mono">{p.git.commitCount}</span></li>
            <li>변경사항: {p.git.dirty ? '있음(dirty)' : '없음'}</li>
          </ul>
        ) : <p className="text-faint text-sm">git 저장소 아님</p>}
      </section>

      <section className="glass mb-4 rounded-2xl p-5">
        <h2 className="text-dim mb-3 text-sm font-semibold uppercase tracking-widest">실행</h2>
        {p.runnable && p.run ? (
          <RunControls folderName={p.folderName} cmd={p.run.cmd} port={p.run.port} projectPath={p.path} />
        ) : <p className="text-faint text-sm">실행 명령 미정의</p>}
      </section>

      <section className="glass mb-4 rounded-2xl p-5">
        <h2 className="text-dim mb-3 text-sm font-semibold uppercase tracking-widest">규칙 검사</h2>
        {p.rules.length === 0 ? (
          <p className="text-emerald-300 text-sm">위반 없음 ✓</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {p.rules.map((r) => (
              <li key={r.id}>
                <span className={r.level === 'error' ? 'text-rose-300' : 'text-amber-300'}>
                  [{r.level}]
                </span>{' '}
                <span className="text-dim">{r.message}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
