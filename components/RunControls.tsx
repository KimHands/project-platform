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
      <p className="text-faint text-xs">실행 명령: <code className="font-mono">{cmd}</code> · <span className="font-mono break-all">{projectPath}</span></p>
      <div className="flex items-center gap-2">
        {running ? (
          <button onClick={() => act('stop')} disabled={busy}
            className="rounded-lg bg-rose-500/80 px-3 py-1.5 text-sm text-white hover:bg-rose-500">중지</button>
        ) : (
          <button onClick={() => act('start')} disabled={busy}
            className="accent-gradient rounded-lg px-3 py-1.5 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-40">
            {busy ? '시작 중…' : '동작'}
          </button>
        )}
        {running && <span className="text-emerald-300 text-xs font-mono">실행 중 (PID {state!.pid})</span>}
        {running && port && (
          <a href={`http://localhost:${port}`} target="_blank" rel="noreferrer"
            className="text-xs font-mono text-fuchsia-300 underline hover:text-fuchsia-200">localhost:{port} 열기</a>
        )}
      </div>
      {error && <p className="text-rose-300 text-sm">{error}</p>}
      {running && log && (
        <pre className="glass max-h-48 overflow-auto rounded-lg p-3 font-mono text-xs text-emerald-200/90">{log}</pre>
      )}
    </div>
  )
}
