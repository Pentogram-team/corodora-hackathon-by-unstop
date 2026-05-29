import { useState, useCallback, useRef, useEffect } from 'react'
import Header from './components/Header'
import StatusBanner from './components/StatusBanner'
import QueryBuilder from './components/QueryBuilder'
import PayloadPane from './components/PayloadPane'
import AuditLog from './components/AuditLog'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export default function App() {
  const [response, setResponse]   = useState(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [auditLog, setAuditLog]   = useState([])
  const [connected, setConnected] = useState(null)   // null = unknown

  const isMutation =
    response?.tier === 'CRITICAL' ||
    response?.force_critical === true

  /* ── Connectivity probe ─────────────────────────── */
  useEffect(() => {
    fetch(`${API_BASE}/api/status`)
      .then(r => r.ok ? setConnected(true) : setConnected(false))
      .catch(() => setConnected(false))
  }, [])

  /* ── Execute query ──────────────────────────────── */
  const executeQuery = useCallback(async (params) => {
    setLoading(true)
    setError(null)
    const t0 = performance.now()

    try {
      const qs = new URLSearchParams()
      if (params.sql?.trim()) {
        qs.set('sql', params.sql.trim())
      } else {
        qs.set('limit',  params.limit)
        qs.set('offset', params.offset)
      }

      const res = await fetch(`${API_BASE}/api/query?${qs}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail || 'Unknown API error')
      }
      const data  = await res.json()
      const rtMs  = performance.now() - t0

      setResponse(data)
      setConnected(true)

      // Push entry to audit log
      setAuditLog(prev => [{
        id:             Date.now(),
        query:          params.sql?.trim() || `limit=${params.limit}&offset=${params.offset}`,
        tier:           data.tier,
        recordCount:    data.record_count,
        serverMs:       data.query_time_ms,
        clientMs:       rtMs.toFixed(1),
        classification: data.classification  || null,
        confidence:     data.confidence      ?? null,
        narrative:      data.narrative       || null,
        llmBackend:     data.llm_backend     || null,
        forceCritical:  data.force_critical  || false,
        isMutation:     data.tier === 'CRITICAL' || !!data.force_critical,
        ts:             new Date().toLocaleTimeString(),
      }, ...prev.slice(0, 99)]) // keep 100 entries
    } catch (err) {
      setError(err.message)
      setConnected(false)
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <div className={`min-h-screen bg-slate-900 text-slate-100 flex flex-col select-none
                     ${isMutation ? 'scanline' : ''}`}>

      <Header connected={connected} isMutation={isMutation} />

      <StatusBanner isMutation={isMutation} loading={loading} response={response} />

      <QueryBuilder onExecute={executeQuery} loading={loading} />

      {/* ── Split pane ──────────────────────────────── */}
      <div className="flex flex-1 gap-3 p-3 pt-0 overflow-hidden min-h-0" style={{ height: 'calc(100vh - 220px)' }}>
        <PayloadPane
          response={response}
          loading={loading}
          error={error}
          isMutation={isMutation}
        />
        <AuditLog log={auditLog} />
      </div>
    </div>
  )
}
