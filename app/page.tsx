import { scanProjects } from '@/lib/scanner/scanProjects'
import { ProjectCard } from '@/components/ProjectCard'
import { countErrors, countWarns } from '@/lib/ui/format'
import { NewProjectDialog } from '@/components/NewProjectDialog'
import { OrcaPanel } from '@/components/OrcaPanel'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const projects = await scanProjects()
  const totalErrors = projects.reduce((n, p) => n + countErrors(p.rules), 0)
  const totalWarns = projects.reduce((n, p) => n + countWarns(p.rules), 0)
  const groups: Array<['project' | 'career', string]> = [
    ['project', 'Projects'], ['career', 'Career'],
  ]
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="accent-text text-3xl font-bold tracking-tight">프로젝트 대시보드</h1>
          <p className="text-dim mt-1 text-sm">로컬 프로젝트를 한눈에 — 기술스택·진행도·규칙</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="glass rounded-full px-4 py-2 font-mono text-xs text-dim">
            위반 <b className="text-rose-400">{totalErrors}</b> · 경고{' '}
            <b className="text-amber-400">{totalWarns}</b> · 총 {projects.length}
          </div>
          <NewProjectDialog />
        </div>
      </header>
      <div className="mb-8"><OrcaPanel /></div>
      {groups.map(([cat, label]) => {
        const items = projects.filter((p) => p.category === cat)
        if (items.length === 0) return null
        return (
          <section key={cat} className="mb-10">
            <h2 className="text-dim mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest">
              <span className="accent-gradient h-1.5 w-1.5 rounded-full" />
              {label}
              <span className="text-faint font-normal normal-case tracking-normal">({items.length})</span>
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((p) => <ProjectCard key={p.path} p={p} />)}
            </div>
          </section>
        )
      })}
    </main>
  )
}
