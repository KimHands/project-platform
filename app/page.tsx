import { scanProjects } from '@/lib/scanner/scanProjects'
import { ProjectCard } from '@/components/ProjectCard'
import { countErrors, countWarns } from '@/lib/ui/format'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const projects = await scanProjects()
  const totalErrors = projects.reduce((n, p) => n + countErrors(p.rules), 0)
  const totalWarns = projects.reduce((n, p) => n + countWarns(p.rules), 0)
  const groups: Array<['project' | 'career', string]> = [
    ['project', 'Projects'], ['career', 'Career'],
  ]
  return (
    <main className="mx-auto max-w-6xl p-8">
      <header className="mb-6 flex items-end justify-between">
        <h1 className="text-2xl font-bold">프로젝트 대시보드</h1>
        <div className="text-sm text-slate-600">
          규칙 위반 <b className="text-red-600">{totalErrors}</b> · 경고{' '}
          <b className="text-amber-600">{totalWarns}</b> · 총 {projects.length}개
        </div>
      </header>
      {groups.map(([cat, label]) => {
        const items = projects.filter((p) => p.category === cat)
        if (items.length === 0) return null
        return (
          <section key={cat} className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-slate-700">{label}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((p) => <ProjectCard key={p.path} p={p} />)}
            </div>
          </section>
        )
      })}
    </main>
  )
}
