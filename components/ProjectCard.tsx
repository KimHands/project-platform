import Link from 'next/link'
import type { ProjectInfo } from '@/lib/scanner/types'
import { StatusBadge } from './StatusBadge'
import { StackIcons } from './StackIcons'
import { countErrors, countWarns } from '@/lib/ui/format'

export function ProjectCard({ p }: { p: ProjectInfo }) {
  const errors = countErrors(p.rules)
  const warns = countWarns(p.rules)
  return (
    <Link href={`/project/${p.folderName}`}
      className={`block rounded-xl border p-4 transition hover:shadow-md ${
        p.hasManifest ? 'bg-white' : 'bg-slate-50 opacity-80'}`}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">{p.name}</h3>
        <StatusBadge status={p.status} />
      </div>
      {p.description && <p className="mb-2 line-clamp-2 text-sm text-slate-600">{p.description}</p>}
      <div className="mb-3">
        {p.progress === null ? (
          <span className="text-xs text-slate-400">진행도 —</span>
        ) : (
          <div className="h-2 w-full rounded-full bg-slate-200">
            <div className="h-2 rounded-full bg-green-500" style={{ width: `${p.progress}%` }} />
          </div>
        )}
      </div>
      <StackIcons stack={p.stack} />
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>{p.git ? `${p.git.branch} · ${p.git.lastCommit}` : 'git 없음'}</span>
        <span className="flex gap-1">
          {errors > 0 && <span className="rounded bg-red-100 px-1.5 text-red-700">위반 {errors}</span>}
          {warns > 0 && <span className="rounded bg-amber-100 px-1.5 text-amber-700">경고 {warns}</span>}
        </span>
      </div>
    </Link>
  )
}
