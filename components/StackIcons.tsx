import type { StackItem } from '@/lib/scanner/types'

export function StackIcons({ stack }: { stack: StackItem[] }) {
  if (stack.length === 0) return <span className="text-xs text-slate-400">스택 미상</span>
  return (
    <div className="flex flex-wrap gap-1.5">
      {stack.map((s) => (
        <span key={s.id} title={s.label}
          className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs">
          <img alt={s.label} width={12} height={12}
            src={`https://cdn.simpleicons.org/${s.icon}`} />
          {s.label}
        </span>
      ))}
    </div>
  )
}
