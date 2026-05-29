import { useState } from 'react'

const TIER_STYLE = {
  SURGICAL: { badge: 'bg-emerald-950 text-emerald-400 border-emerald-500/40', dot: 'bg-emerald-400' },
  ELEVATED: { badge: 'bg-amber-950  text-amber-400  border-amber-500/40',  dot: 'bg-amber-400'  },
  CRITICAL: { badge: 'bg-red-950    text-red-400    border-red-500/40',    dot: 'bg-red-500 animate-pulse' },
}

function ConfidenceBar({ value }) {
  if (value === null || value === undefined) return null
  const pct  = Math.round(value * 100)
  const isHighThreat = pct >= 80
  const color = isHighThreat ? 'bg-red-500' : pct >= 50 ? 'bg-amber-500' : 'bg-emerald-500'
  const glowStyle = isHighThreat ? { boxShadow: '0 0 12px rgba(239,68,68,0.8)' } : {}

  return (
    <div className="mt-1 flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden" style={glowStyle}>
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[10px] font-mono ${isHighThreat ? 'text-red-400 animate-pulse' : 'text-slate-500'}`}>
        {pct}%
      </span>
    </div>
  )
}

function LogEntry({ entry, isFirst }) {
  const [expanded, setExpanded] = useState(isFirst)
  const ts = TIER_STYLE[entry.tier]

  return (
    <div className={`border rounded-lg overflow-hidden transition-all animate-fade-in
      ${entry.isMutation ? 'border-red-500/30 bg-red-950/10' : 'border-slate-700/50 bg-slate-800/20'}`}>

      {/* ── Entry header ─────────────────────────── */}
      <button
        onClick={() => setExpanded(x => !x)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-800/30 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${ts?.dot ?? 'bg-slate-500'}`} />
          <span className="text-[11px] font-mono text-slate-300 truncate max-w-[180px]">
            {entry.query}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span className={`px-1.5 py-0.5 text-[10px] font-mono rounded border ${ts?.badge ?? ''}`}>
            {entry.tier}
          </span>
          <span className="text-[10px] text-slate-600 font-mono">{entry.ts}</span>
          <span className={`text-slate-600 text-[10px] transition-transform ${expanded ? 'rotate-180' : ''}`}>▾</span>
        </div>
      </button>

      {/* ── Expanded detail ──────────────────────── */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-slate-800/50 space-y-3">

          {/* SQL / query */}
          <div className="mt-2">
            <div className="text-[10px] text-slate-500 font-mono tracking-wider mb-1">QUERY</div>
            <pre className="text-[11px] text-cyan-300/80 font-mono bg-slate-900/60 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
              {entry.query}
            </pre>
          </div>

          {/* Execution timing */}
          <div className="grid grid-cols-3 gap-2">
            {[
              ['RECORDS',    entry.recordCount],
              ['SERVER',     `${entry.serverMs?.toFixed(2)}ms`],
              ['ROUND-TRIP', `${entry.clientMs}ms`],
            ].map(([k, v]) => (
              <div key={k} className="bg-slate-900/50 rounded p-2 text-center">
                <div className="text-[9px] text-slate-600 font-mono tracking-wider">{k}</div>
                <div className="text-xs text-slate-300 font-mono mt-0.5">{v}</div>
              </div>
            ))}
          </div>

          {/* LLM SOC analysis (ELEVATED tier) */}
          {entry.classification && (
            <div className={`rounded border p-2.5 space-y-1.5
              ${entry.classification === 'MASS_SURVEILLANCE'
                ? 'border-red-500/30 bg-red-950/20'
                : 'border-emerald-500/20 bg-emerald-950/10'}`}>
              <div className="text-[10px] text-slate-500 font-mono tracking-wider flex items-center justify-between">
                <span>SOC ANALYST · {entry.llmBackend?.toUpperCase()}</span>
                {entry.forceCritical && (
                  <span className="text-red-400 text-[9px] px-1.5 py-0.5 border border-red-500/30 rounded bg-red-950/40">
                    ESCALATED → CRITICAL
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 text-[10px] font-bold font-mono rounded border
                  ${entry.classification === 'MASS_SURVEILLANCE'
                    ? 'bg-red-950 text-red-400 border-red-500/40'
                    : 'bg-emerald-950 text-emerald-400 border-emerald-500/40'}`}>
                  {entry.classification}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">confidence</span>
              </div>

              <ConfidenceBar value={entry.confidence} />

              {entry.narrative && (
                <div className="mt-2">
                  <div className="text-[10px] text-slate-600 font-mono mb-1">THREAT NARRATIVE</div>
                  <p className="text-[11px] text-slate-300 leading-relaxed italic">
                    "{entry.narrative}"
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Mutation flag */}
          {entry.isMutation && (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded border border-red-500/30 bg-red-950/20">
              <span className="text-red-400 text-xs">⚠</span>
              <span className="text-[10px] text-red-400 font-mono">
                HEISENBERG COUNTERMEASURE ACTIVE — caller received poisoned payloads
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function AuditLog({ log }) {
  return (
    <div className="flex flex-col w-80 xl:w-96 shrink-0 rounded-lg border border-slate-700/60
                    bg-slate-900/60 backdrop-blur-sm overflow-hidden">

      {/* ── Panel header ────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/80 shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-violet-400" />
          <span className="text-[11px] font-mono tracking-widest text-slate-400">
            ADMIN AUDIT LOG
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-600 font-mono">{log.length} entries</span>
          {log.some(e => e.isMutation) && (
            <span className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-red-950 text-red-400 border border-red-500/30 animate-pulse">
              MUTATIONS LOGGED
            </span>
          )}
        </div>
      </div>

      {/* ── Log list ────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-2">
        {log.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-700 gap-2">
            <div className="text-3xl">📋</div>
            <p className="text-[11px] font-mono tracking-wider">AUDIT LOG EMPTY</p>
            <p className="text-[10px] text-slate-800 text-center">
              Query results and SOC narratives will appear here
            </p>
          </div>
        ) : (
          log.map((entry, i) => (
            <LogEntry key={entry.id} entry={entry} isFirst={i === 0} />
          ))
        )}
      </div>

      {/* ── Footer legend ───────────────────────────── */}
      <div className="px-4 py-2 border-t border-slate-800/60 shrink-0">
        <div className="flex items-center justify-between text-[9px] text-slate-700 font-mono">
          <span>↕ CLICK ENTRY TO EXPAND</span>
          <span className="flex gap-3">
            <span className="text-emerald-700">● SURGICAL</span>
            <span className="text-amber-700">● ELEVATED</span>
            <span className="text-red-700">● CRITICAL</span>
          </span>
        </div>
      </div>
    </div>
  )
}
