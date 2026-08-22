'use client'
import { useEffect, useState, useCallback } from 'react'

interface RunState { folderName: string; running: boolean; pid: number | null; port: number | null; startedAt: number | null }

export function RunControls({ folderName, cmd, port, projectPath }: {
  folderName: string; cmd: string; port: number | null; projectPath: string
}) {
  const [state, setState] = useState<RunState | null>(null)
  const [log, setLog] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const s = await (await fetch(`/api/run?folderName=${encodeURIComponent(folderName)}`)).json()
      setState(s)
      if (s.running) {
        const l = await (await fetch(`/api/run/logs?folderName=${encodeURIComponent(folderName)}`)).json()
        setLog(l.log ?? '')
      }
    } catch {}
  }, [folderName])
  useEffect(() => { load(); const t = setInterval(load, 3000); return () => clearInterval(t) }, [load])

  async function act(action: 'start' | 'stop') {
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/run', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ folderName, action }),
      })
      const d = await res.json()
      if (!res.ok) setError(d.error ?? '실패')
      await load()
    } catch { setError('네트워크 오류') } finally { setBusy(false) }
  }

  const running = state?.running
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">실행 명령: <code>{cmd}</code> · <span className="break-all">{projectPath}</span></p>
      <div className="flex items-center gap-2">
        {running ? (
          <button onClick={() => act('stop')} disabled={busy}
            className="rounded bg-red-600 px-3 py-1.5 text-sm text-white disabled:opacity-40">중지</button>
        ) : (
          <button onClick={() => act('start')} disabled={busy}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-40">
            {busy ? '시작 중…' : '동작'}
          </button>
        )}
        {running && <span className="text-xs text-green-700">실행 중 (PID {state!.pid})</span>}
        {running && port && (
          <a href={`http://localhost:${port}`} target="_blank" rel="noreferrer"
            className="text-xs text-blue-600 underline">localhost:{port} 열기</a>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {running && log && (
        <pre className="max-h-48 overflow-auto rounded bg-slate-900 p-2 text-xs text-slate-100">{log}</pre>
      )}
    </div>
  )
}
