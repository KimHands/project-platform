import type { StackItem } from '@/lib/scanner/types'

export function StackIcons({ stack }: { stack: StackItem[] }) {
  if (stack.length === 0) return <span className="text-faint text-xs">스택 미상</span>
  return (
    <div className="flex flex-wrap gap-1.5">
      {stack.map((s) => (
        <span key={s.id} title={s.label}
          className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-xs text-dim">
          <img alt={s.label} width={12} height={12} className="opacity-90"
            src={`https://cdn.simpleicons.org/${s.icon}/ffffff`} />
          {s.label}
        </span>
      ))}
    </div>
  )
}
