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
      className={`glass glass-hover block rounded-2xl p-4 ${p.hasManifest ? '' : 'opacity-60'}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="truncate font-semibold text-white">{p.name}</h3>
        <StatusBadge status={p.status} />
      </div>
      {p.description && <p className="text-dim mb-3 line-clamp-2 text-sm">{p.description}</p>}
      <div className="mb-3">
        {p.progress === null ? (
          <span className="text-faint font-mono text-xs">진행도 —</span>
        ) : (
          <div className="flex items-center gap-2">
            <div className="progress-track h-1.5 flex-1 overflow-hidden rounded-full">
              <div className="progress-fill h-full rounded-full" style={{ width: `${p.progress}%` }} />
            </div>
            <span className="text-dim font-mono text-xs">{p.progress}%</span>
          </div>
        )}
      </div>
      <StackIcons stack={p.stack} />
      <div className="text-faint mt-3 flex items-center justify-between font-mono text-xs">
        <span className="truncate">{p.git ? `${p.git.branch} · ${p.git.lastCommit}` : 'git 없음'}</span>
        <span className="flex shrink-0 gap-1">
          {errors > 0 && <span className="rounded bg-rose-500/15 px-1.5 text-rose-300">위반 {errors}</span>}
          {warns > 0 && <span className="rounded bg-amber-500/15 px-1.5 text-amber-300">경고 {warns}</span>}
        </span>
      </div>
    </Link>
  )
}
