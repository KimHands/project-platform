import type { Status } from '@/lib/scanner/types'

const STYLE: Record<Status, string> = {
  planning: 'bg-slate-200 text-slate-700',
  active: 'bg-green-200 text-green-800',
  paused: 'bg-yellow-200 text-yellow-800',
  done: 'bg-blue-200 text-blue-800',
}
const LABEL: Record<Status, string> = {
  planning: '기획', active: '진행중', paused: '중단', done: '완료',
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STYLE[status]}`}>
      {LABEL[status]}
    </span>
  )
}
