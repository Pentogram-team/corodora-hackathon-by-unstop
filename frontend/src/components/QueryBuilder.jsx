import { useState } from 'react'

const PRESET_QUERIES = [
  { label: 'Surgical ×3',  params: { limit: 3,  offset: 0, sql: '' } },
  { label: 'Elevated ×7',  params: { limit: 7,  offset: 0, sql: '' } },
  { label: 'Critical ×20', params: { limit: 20, offset: 0, sql: '' } },
  { label: 'All ×50',      params: { limit: 50, offset: 0, sql: '' } },
]

export default function QueryBuilder({ onExecute, loading }) {
  const [limit,  setLimit]  = useState(5)
  const [offset, setOffset] = useState(0)
  const [sql,    setSql]    = useState('')
  const [mode,   setMode]   = useState('simple')  // 'simple' | 'sql'

  const handleExecute = () => {
    onExecute({ limit, offset, sql: mode === 'sql' ? sql : '' })
  }

  const handlePreset = (p) => {
    setLimit(p.limit)
    setOffset(p.offset)
    setSql(p.sql)
    setMode('simple')
    onExecute(p)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && mode === 'sql') {
      e.preventDefault()
      handleExecute()
    }
  }

  return (
    <div className="mx-3 mb-3 shrink-0">
      <div className="rounded-lg border border-slate-700/60 bg-slate-800/40 backdrop-blur-sm overflow-hidden">

        {/* ── Tab strip ─────────────────────────────── */}
        <div className="flex items-center justify-between px-3 pt-2 pb-0 border-b border-slate-700/50">
          <div className="flex gap-1">
            {['simple', 'sql'].map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 text-[11px] font-mono tracking-wider rounded-t transition-colors
                  ${mode === m
                    ? 'text-cyan-400 border-b-2 border-cyan-400 bg-slate-900/50'
                    : 'text-slate-500 hover:text-slate-300'
                  }`}
              >
                {m === 'simple' ? 'PARAMS' : 'RAW SQL'}
              </button>
            ))}
          </div>

          {/* Presets */}
          <div className="flex items-center gap-1.5 pb-1">
            <span className="text-[10px] text-slate-600 font-mono mr-1">PRESET:</span>
            {PRESET_QUERIES.map(p => (
              <button
                key={p.label}
                onClick={() => handlePreset(p.params)}
                disabled={loading}
                className="px-2 py-0.5 text-[10px] font-mono rounded border border-slate-600/50
                           text-slate-400 hover:text-slate-200 hover:border-slate-500
                           transition-colors disabled:opacity-40"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Input area ────────────────────────────── */}
        <div className="flex items-end gap-3 p-3">

          {mode === 'simple' ? (
            <>
              {/* Limit */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-500 font-mono tracking-wider">LIMIT</label>
                <input
                  type="number"
                  min={1} max={50}
                  value={limit}
                  onChange={e => setLimit(Number(e.target.value))}
                  className="w-20 px-2 py-1.5 rounded bg-slate-900 border border-slate-600
                             text-cyan-400 font-mono text-sm focus:outline-none
                             focus:border-cyan-500/60 transition-colors"
                />
              </div>

              {/* Offset */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-500 font-mono tracking-wider">OFFSET</label>
                <input
                  type="number"
                  min={0}
                  value={offset}
                  onChange={e => setOffset(Number(e.target.value))}
                  className="w-20 px-2 py-1.5 rounded bg-slate-900 border border-slate-600
                             text-cyan-400 font-mono text-sm focus:outline-none
                             focus:border-cyan-500/60 transition-colors"
                />
              </div>

              {/* Live tier preview */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-500 font-mono tracking-wider">PREDICTED TIER</label>
                <div className={`px-3 py-1.5 rounded border text-xs font-mono
                  ${limit < 5  ? 'bg-emerald-950 text-emerald-400 border-emerald-500/40' :
                    limit <= 10 ? 'bg-amber-950  text-amber-400  border-amber-500/40' :
                                  'bg-red-950    text-red-400    border-red-500/40'}`}>
                  {limit < 5 ? 'SURGICAL' : limit <= 10 ? 'ELEVATED' : 'CRITICAL'}
                </div>
              </div>
            </>
          ) : (
            /* SQL textarea */
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[10px] text-slate-500 font-mono tracking-wider">
                SELECT STATEMENT  <span className="text-slate-600">— table: sensitive_records  |  ⏎ to execute</span>
              </label>
              <textarea
                rows={2}
                value={sql}
                onChange={e => setSql(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="SELECT * FROM sensitive_records WHERE id IN (1,2,3,4,5,6,7,8) LIMIT 8"
                className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-600
                           text-cyan-300 font-mono text-xs focus:outline-none
                           focus:border-cyan-500/60 transition-colors placeholder:text-slate-700
                           resize-none"
              />
            </div>
          )}

          {/* ── Execute button ─────────────────────── */}
          <button
            onClick={handleExecute}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 rounded bg-cyan-600 hover:bg-cyan-500
                       text-slate-950 font-bold text-xs font-mono tracking-widest
                       transition-all disabled:opacity-40 disabled:cursor-not-allowed
                       active:scale-95 btn-pulse"
          >
            {loading ? (
              <>
                <span className="w-3 h-3 border-2 border-slate-950/40 border-t-slate-950 rounded-full animate-spin" />
                QUERYING
              </>
            ) : (
              <>⚡ EXECUTE</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
