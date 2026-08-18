'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FOLDER_RE } from '@/lib/rules'

export function NewProjectDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState<'project' | 'career'>('project')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('planning')
  const [tags, setTags] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const nameValid = FOLDER_RE.test(name)
  const rootLabel = category === 'project' ? 'Projects' : 'Career'
  const preview = `~/Desktop/${rootLabel}/${name || '<이름>'}`

  async function submit() {
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name, category, description,
          status,
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? '실패'); setBusy(false); return }
      setOpen(false); setBusy(false)
      router.push(`/project/${data.folderName}`)
      router.refresh()
    } catch {
      setError('네트워크 오류'); setBusy(false)
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700">
        + 새 프로젝트
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => !busy && setOpen(false)}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-semibold">새 프로젝트</h2>
        <label className="mb-2 block text-sm">
          폴더명
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1" placeholder="my-project" />
          {name && !nameValid && (
            <span className="text-xs text-red-600">소문자·숫자·하이픈만 가능</span>
          )}
        </label>
        <label className="mb-2 block text-sm">
          카테고리
          <select value={category} onChange={(e) => setCategory(e.target.value as 'project' | 'career')}
            className="mt-1 w-full rounded border px-2 py-1">
            <option value="project">Projects (마감·산출물)</option>
            <option value="career">Career (진로·이력)</option>
          </select>
        </label>
        <label className="mb-2 block text-sm">
          설명
          <input value={description} onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1" />
        </label>
        <div className="mb-2 grid grid-cols-2 gap-2">
          <label className="block text-sm">
            상태
            <select value={status} onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full rounded border px-2 py-1">
              <option value="planning">기획</option>
              <option value="active">진행중</option>
              <option value="paused">중단</option>
              <option value="done">완료</option>
            </select>
          </label>
          <label className="block text-sm">
            태그(쉼표)
            <input value={tags} onChange={(e) => setTags(e.target.value)}
              className="mt-1 w-full rounded border px-2 py-1" placeholder="web, security" />
          </label>
        </div>
        <p className="mb-3 text-xs text-slate-500">생성 위치: <code>{preview}</code></p>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={() => setOpen(false)} disabled={busy}
            className="rounded px-3 py-1.5 text-sm text-slate-600">취소</button>
          <button onClick={submit} disabled={!nameValid || busy}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-40">
            {busy ? '생성 중…' : '생성'}
          </button>
        </div>
      </div>
    </div>
  )
}
