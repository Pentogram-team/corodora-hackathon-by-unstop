import { useState, useEffect, useRef } from 'react'

const TIER_STYLE = {
  SURGICAL: 'bg-emerald-950 text-emerald-400 border-emerald-500/40',
  ELEVATED: 'bg-amber-950  text-amber-400  border-amber-500/40',
  CRITICAL: 'bg-red-950    text-red-400    border-red-500/40',
}

const HEX_CHARS = "0123456789ABCDEF"
const generateHexNoise = (length) => {
  let result = ""
  for (let i = 0; i < length; i++) {
    result += HEX_CHARS[Math.floor(Math.random() * 16)]
  }
  return result
}

export default function PayloadPane({ response, loading, error, isMutation, showDetected }) {
  const [displayText, setDisplayText] = useState('')
  const [detected, setDetected]       = useState(false)
  const timerRef = useRef(null)

  // 3-second "DETECTED" overlay triggered externally via showDetected prop
  useEffect(() => {
    if (!showDetected) return
    setDetected(true)
    const t = setTimeout(() => setDetected(false), 3000)
    return () => clearTimeout(t)
  }, [showDetected])

  useEffect(() => {
    // Clear any existing intervals on new render
    if (timerRef.current) clearInterval(timerRef.current)

    if (loading) {
      setDisplayText("AWAITING VAULT DECRYPTION...")
      return
    }

    if (!response) {
      setDisplayText("")
      return
    }

    // fallback to full response if response.records doesn't exist
    const targetData = response.records || response
    const targetJson = JSON.stringify(targetData, null, 2)
    const targetLength = targetJson.length

    if (isMutation) {
      const endTime = Date.now() + 800
      
      timerRef.current = setInterval(() => {
        if (Date.now() > endTime) {
          clearInterval(timerRef.current)
          setDisplayText(targetJson)
        } else {
          // Generate raw hex noise matching the length of the stringified payload
          // Cap it at 3000 chars so we don't choke the React render cycle during 30ms intervals
          const noise = generateHexNoise(Math.min(targetLength, 3000))
          setDisplayText(noise)
        }
      }, 30)
    } else {
      setDisplayText(targetJson)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [response, loading, isMutation])

  const borderClass = isMutation
    ? 'border-red-500/40 animate-border-pulse'
    : 'border-slate-700/60'

  const textStyleClass = isMutation 
    ? 'text-red-500 font-mono tracking-widest' 
    : 'text-emerald-400 font-mono'

  return (
    <div className={`flex flex-col flex-1 min-w-0 rounded-lg border bg-slate-900/60 backdrop-blur-sm overflow-hidden transition-all ${borderClass}`}>

      {/* ── Panel header ────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/80 shrink-0">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isMutation ? 'bg-red-500 animate-pulse' : 'bg-cyan-400'}`} />
          <span className="text-[11px] font-mono tracking-widest text-slate-400">
            RAW VAULT RESPONSE
          </span>
        </div>
        <div className="flex items-center gap-2">
          {response?.tier && (
            <span className={`px-2 py-0.5 text-[10px] font-mono rounded border ${TIER_STYLE[response.tier] ?? ''}`}>
              {response.tier}
            </span>
          )}
          {response?.record_count !== undefined && (
            <span className="text-[10px] text-slate-600 font-mono">
              {response.record_count} records
            </span>
          )}
        </div>
      </div>

      {/* ── Mutation warning strip ───────────────────── */}
      {isMutation && (
        <div className="px-4 py-2 bg-red-950/40 border-b border-red-500/20 shrink-0">
          <p className="text-[10px] text-red-400/80 font-mono leading-relaxed">
            ⚠ HEISENBERG EFFECT ACTIVE — payloads below are Fernet tokens encrypted
            with an ephemeral salt-derived key. They are structurally valid but will
            never decrypt with the real VAULT_MASTER_KEY. HTTP 200 returned to deceive caller.
          </p>
        </div>
      )}

      {/* ── Body ────────────────────────────────────── */}
      <div className="flex-1 overflow-auto min-h-0 relative p-4">

        {/* GUEST MODE: Detection Overlay */}
        {detected && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="text-center px-6 animate-pulse">
              <div className="text-red-400 text-xl font-mono font-bold tracking-widest leading-loose"
                   style={{ textShadow: '0 0 30px rgba(239,68,68,0.9)' }}>
                YOUR OBSERVATION WAS DETECTED.
              </div>
              <div className="text-red-500 text-lg font-mono font-bold tracking-widest"
                   style={{ textShadow: '0 0 20px rgba(239,68,68,0.7)' }}>
                THE VAULT MADE YOU BLIND.
              </div>
            </div>
          </div>
        )}
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 z-10 backdrop-blur-sm">
            <div className="w-12 h-12 border-2 border-slate-700 border-t-cyan-400 rounded-full animate-spin mb-4" />
            <span className="text-xs text-slate-500 font-mono animate-pulse">
              {displayText}
            </span>
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col gap-2">
            <div className="text-red-400 text-xs font-mono font-bold">CONNECTION ERROR</div>
            <pre className="text-red-300/70 text-[11px] font-mono whitespace-pre-wrap">{error}</pre>
            <p className="text-slate-600 text-[10px] mt-2">
              Ensure the FastAPI server is running:
              uvicorn backend.main:app --reload --port 8000
            </p>
          </div>
        )}

        {!loading && !error && !response && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-600">
            <div className="text-4xl">🔐</div>
            <p className="text-xs font-mono tracking-wider">NO QUERY EXECUTED YET</p>
            <p className="text-[10px] text-slate-700">Use the controls above to query the vault</p>
          </div>
        )}

        {!loading && !error && response && (
          <pre className={`text-[11px] whitespace-pre-wrap break-all ${textStyleClass} ${isMutation ? 'text-glow-red' : ''}`}>
            {displayText}
          </pre>
        )}
      </div>

      {/* ── Footer stats ────────────────────────────── */}
      {response && (
        <div className="px-4 py-2 border-t border-slate-800/60 flex items-center justify-between shrink-0">
          <span className="text-[10px] text-slate-600 font-mono">
            {new Date(response.timestamp).toLocaleTimeString()}
          </span>
          <div className="flex gap-4 text-[10px] font-mono text-slate-600">
            <span>server: {response.query_time_ms?.toFixed(2)}ms</span>
            <span>size: {(JSON.stringify(response).length / 1024).toFixed(1)}KB</span>
          </div>
        </div>
      )}
    </div>
  )
}
