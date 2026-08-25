import type { Status } from '@/lib/scanner/types'

const STYLE: Record<Status, string> = {
  planning: 'bg-slate-400/10 text-slate-300 ring-slate-400/20',
  active: 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/20',
  paused: 'bg-amber-400/10 text-amber-300 ring-amber-400/20',
  done: 'bg-violet-400/10 text-violet-300 ring-violet-400/20',
}
const DOT: Record<Status, string> = {
  planning: 'bg-slate-400', active: 'bg-emerald-400', paused: 'bg-amber-400', done: 'bg-violet-400',
}
const LABEL: Record<Status, string> = {
  planning: '기획', active: '진행중', paused: '중단', done: '완료',
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLE[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[status]} shadow-[0_0_6px] shadow-current`} />
      {LABEL[status]}
    </span>
  )
}
