import { useEffect, useRef, useState } from 'react'

export default function StatusBanner({ isMutation, loading, response }) {
  const [benchmarking, setBenchmarking] = useState(false)
  const [benchData, setBenchData] = useState(null)

  const runBenchmark = async () => {
    setBenchmarking(true)
    try {
      const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
      const res = await fetch(`${API_BASE}/api/benchmark`)
      const data = await res.json()
      setBenchData(data)
    } catch (e) {
      console.error(e)
    } finally {
      setBenchmarking(false)
    }
  }

  const prevMutation = useRef(false)
  const audioCtx = useRef(null)

  /* ── Subtle tone on state change ─────────────── */
  useEffect(() => {
    if (isMutation === prevMutation.current) return
    prevMutation.current = isMutation

    try {
      if (!audioCtx.current) audioCtx.current = new AudioContext()
      const ctx = audioCtx.current
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = isMutation ? 220 : 523
      osc.type = isMutation ? 'sawtooth' : 'sine'
      gain.gain.setValueAtTime(0.08, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
      osc.start()
      osc.stop(ctx.currentTime + 0.4)
    } catch (_) { /* AudioContext blocked — fine */ }
  }, [isMutation])

  if (loading) {
    return (
      <div className="mx-3 my-2 shrink-0">
        <div className="flex items-center gap-3 px-5 py-3 rounded-lg border border-slate-700 bg-slate-800/60 animate-pulse">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span className="text-xs text-slate-400 tracking-widest font-mono">QUERYING VAULT…</span>
        </div>
      </div>
    )
  }

  if (isMutation) {
    return (
      <div className="mx-3 my-2 shrink-0 animate-slide-down">
        <div className="relative overflow-hidden flex items-center justify-between px-5 py-3.5 rounded-lg
                        border border-red-500/60 bg-red-950/60 animate-border-pulse"
             style={{ boxShadow: '0 0 30px rgba(239,68,68,0.25), inset 0 1px 0 rgba(239,68,68,0.1)' }}>

          {/* Scan line */}
          <div className="absolute inset-0 pointer-events-none"
               style={{
                 background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(239,68,68,0.03) 2px, rgba(239,68,68,0.03) 4px)',
               }} />

          <div className="flex items-center gap-4">
            <span className="text-red-400 text-lg animate-flicker">⚠</span>
            <div>
              <div className="text-red-300 font-bold tracking-widest text-sm animate-flicker font-mono"
                   style={{ textShadow: '0 0 12px rgba(239,68,68,0.8)' }}>
                MUTATION TRIGGERED: BLINDING OBSERVATION
              </div>
              <div className="text-red-500/80 text-[10px] tracking-wider mt-0.5 font-mono">
                HEISENBERG COUNTERMEASURE ACTIVE · PAYLOAD OBFUSCATION ENGAGED · HTTP 200 DECEPTION MODE
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 ml-4">
            {response && (
              <div className="text-right text-[10px] text-red-400/60 font-mono">
                <div>{response.record_count} records poisoned</div>
                <div>{response.query_time_ms?.toFixed(2)}ms</div>
              </div>
            )}
            <div className="px-2 py-1 rounded bg-red-900/50 border border-red-500/30 text-red-400 text-[10px] font-mono animate-pulse">
              TIER: CRITICAL
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ── SECURE state ─────────────────────────────── */
  const tier = response?.tier ?? null
  return (
    <div className="mx-3 my-2 shrink-0 animate-slide-down">
      <div className="flex items-center justify-between px-5 py-3.5 rounded-lg
                      border border-emerald-500/30 bg-emerald-950/40"
           style={{ boxShadow: '0 0 20px rgba(52,211,153,0.08)' }}>

        <div className="flex items-center gap-4">
          <span className="text-emerald-400 text-lg">●</span>
          <div>
            <div className="text-emerald-300 font-bold tracking-widest text-sm font-mono"
                 style={{ textShadow: '0 0 10px rgba(52,211,153,0.5)' }}>
              VAULT SECURE
            </div>
            <div className="text-emerald-600 text-[10px] tracking-wider mt-0.5 font-mono">
              {response
                ? 'ENCRYPTION KEYS INTACT · PAYLOADS AUTHENTIC'
                : 'AWAITING QUERY · ALL SYSTEMS NOMINAL'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 ml-4">
          {response && (
            <div className="text-right text-[10px] text-emerald-500/70 font-mono">
              <div>{response.record_count} records</div>
              <div>{response.query_time_ms?.toFixed(2)}ms</div>
            </div>
          )}
          {tier && (
            <div className={`px-2 py-1 rounded border text-[10px] font-mono
              ${tier === 'SURGICAL' ? 'bg-emerald-950 text-emerald-400 border-emerald-500/40' :
                tier === 'ELEVATED' ? 'bg-amber-950 text-amber-400 border-amber-500/40' :
                                     'bg-red-950 text-red-400 border-red-500/40'}`}>
              TIER: {tier}
            </div>
          )}
          <button 
            onClick={runBenchmark}
            disabled={benchmarking}
            className="bg-slate-700 hover:bg-slate-600 text-slate-300 text-[10px] font-mono px-2 py-1 rounded transition-colors disabled:opacity-50"
          >
            {benchmarking ? 'BENCHMARKING...' : '⚡ BENCHMARK'}
          </button>
        </div>
      </div>

      {benchData && (
        <div className="animate-slide-down mt-2 px-5 py-2.5 rounded-lg border border-slate-700 bg-slate-800/60 flex items-center justify-between">
          <div className="text-[10px] font-mono text-slate-300">
            SURGICAL avg: {benchData.surgical.avg_ms}ms | CRITICAL avg: {benchData.critical.avg_ms}ms
          </div>
          <div className="text-[10px] font-mono text-emerald-400 font-bold tracking-widest">
            VERDICT: {benchData.surgical.verdict}
          </div>
        </div>
      )}
    </div>
  )
}
