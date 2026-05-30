export default function Header({ connected, isMutation, resetDemo, wsLive }) {
  return (
    <header className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md z-50 shrink-0">

      {/* ── Brand ─────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded flex items-center justify-center text-sm font-bold border
          ${isMutation
            ? 'bg-red-950 border-red-500/60 text-red-400 animate-pulse'
            : 'bg-emerald-950 border-emerald-500/40 text-emerald-400'
          }`}>
          ⬡
        </div>
        <div>
          <div className="text-sm font-bold tracking-widest text-slate-100 font-mono">
            HEISENBERG VAULT
          </div>
          <div className="text-[10px] text-slate-500 tracking-wider">
            ZERO-TRUST MEDICAL RECORD SYSTEM · v1.0.0
          </div>
        </div>
      </div>

      {/* ── Right cluster ──────────────────────────── */}
      <div className="flex items-center gap-4">
        {/* Protocol badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded border border-slate-700 text-[10px] text-slate-500 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 opacity-70" />
          AES-128-CBC · FERNET
        </div>

        {/* Tier legend */}
        <div className="hidden md:flex items-center gap-2 text-[10px] font-mono">
          <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/30">SURGICAL</span>
          <span className="px-1.5 py-0.5 rounded bg-amber-950  text-amber-400  border border-amber-500/30">ELEVATED</span>
          <span className="px-1.5 py-0.5 rounded bg-red-950    text-red-400    border border-red-500/30">CRITICAL</span>
        </div>

        {/* RESET DEMO button */}
        {resetDemo && (
          <button
            onClick={resetDemo}
            className="bg-slate-800 border border-slate-700 text-slate-400 text-[10px] font-mono px-2 py-1 rounded hover:bg-slate-700 transition-colors"
          >
            ↺ RESET DEMO
          </button>
        )}

        {/* WebSocket LIVE indicator */}
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-mono transition-colors
          ${wsLive
            ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-400'
            : 'border-slate-700 bg-slate-800/40 text-slate-600'
          }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${wsLive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
          LIVE
        </div>

        {/* Connection status */}
        <div className="flex items-center gap-2 text-[11px] font-mono">
          <span className={`w-2 h-2 rounded-full ${
            connected === null  ? 'bg-slate-500 animate-pulse' :
            connected           ? 'bg-emerald-400' :
                                  'bg-red-500 animate-pulse'
          }`} />
          <span className={
            connected === null ? 'text-slate-500' :
            connected          ? 'text-emerald-400' :
                                 'text-red-400'
          }>
            {connected === null ? 'PROBING…' : connected ? 'API ONLINE' : 'API OFFLINE'}
          </span>
        </div>
      </div>
    </header>
  )
}
