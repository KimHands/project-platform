'use client'
import { useEffect, useState, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'

interface StatusResp {
  status: { installed: boolean; desktopRunning: boolean; version: string | null; reachable: boolean }
  reachability: { address: string | null; kind: string; allowed: boolean; tailscaleAvailable: boolean }
  serve: { running: boolean; serve: { browserUrl: string | null; mobileUrl: string | null; endpoint: string | null } | null }
  environments: { name: string; endpoint?: string }[]
}

export function OrcaPanel() {
  const [data, setData] = useState<StatusResp | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try { setData(await (await fetch('/api/orca/status')).json()) } catch {}
  }, [])
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t) }, [load])

  async function act(action: 'start' | 'stop') {
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/orca/serve', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const d = await res.json()
      if (!res.ok) setError(d.error ?? '실패')
      await load()
    } catch { setError('네트워크 오류') } finally { setBusy(false) }
  }

  if (!data) return <div className="rounded-xl border p-4 text-sm text-slate-500">Orca 상태 확인 중…</div>
  const { status, reachability, serve, environments } = data
  const running = serve?.running && serve.serve

  return (
    <section className="rounded-xl border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Orca 원격 이어가기</h2>
        <span className={`rounded-full px-2 py-0.5 text-xs ${status.installed ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-600'}`}>
          {status.installed ? `실행 중 · v${status.version ?? '?'}` : 'Orca 미설치'}
        </span>
      </div>

      <p className="mb-2 text-xs text-slate-500">
        도달 주소: {reachability.address ? `${reachability.address} (${reachability.kind})` : 'Tailscale 필요 — README의 F2 참고'}
      </p>

      {running ? (
        <div className="space-y-2">
          <p className="text-sm text-green-700">원격 모드 실행 중</p>
          {serve!.serve!.browserUrl && (
            <div>
              <p className="text-xs font-medium">집 컴퓨터(브라우저)로 접속</p>
              <code className="block break-all text-xs">{serve!.serve!.browserUrl}</code>
              <QRCodeSVG value={serve!.serve!.browserUrl} size={112} className="mt-1" />
            </div>
          )}
          {serve!.serve!.mobileUrl && (
            <div>
              <p className="text-xs font-medium">모바일</p>
              <QRCodeSVG value={serve!.serve!.mobileUrl} size={112} />
            </div>
          )}
          <button onClick={() => act('stop')} disabled={busy}
            className="rounded bg-slate-200 px-3 py-1.5 text-sm">중지</button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-amber-700">
            ⚠ 시작하면 Orca 런타임이 {reachability.kind === 'tailscale' ? 'Tailscale' : '사설망'}에 노출됩니다. 데스크톱 앱을 먼저 닫으세요.
          </p>
          <button onClick={() => act('start')} disabled={busy || status.desktopRunning || !reachability.allowed}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-40">
            {busy ? '시작 중…' : '원격 이어가기 시작'}
          </button>
          {status.desktopRunning && <p className="text-xs text-slate-500">데스크톱 실행 중 — 닫으면 활성화됩니다.</p>}
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {environments.length > 0 && (
        <div className="mt-3 border-t pt-2">
          <p className="text-xs font-medium">저장된 원격 환경</p>
          <ul className="text-xs text-slate-600">
            {environments.map((e) => <li key={e.name}>{e.name}{e.endpoint ? ` · ${e.endpoint}` : ''}</li>)}
          </ul>
        </div>
      )}
    </section>
  )
}
