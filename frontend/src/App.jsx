import { useState, useCallback, useRef, useEffect } from 'react'
import Header from './components/Header'
import StatusBanner from './components/StatusBanner'
import QueryBuilder from './components/QueryBuilder'
import PayloadPane from './components/PayloadPane'
import AuditLog from './components/AuditLog'
import ThreatGraph from './components/ThreatGraph'
import LoginScreen from './components/LoginScreen'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000'

export default function App() {
  const [authed, setAuthed] = useState(!!sessionStorage.getItem('vault_admin_token'))
  const [response, setResponse]   = useState(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [auditLog, setAuditLog]   = useState([])
  const [connected, setConnected] = useState(null)   // null = unknown
  const [showDetected, setShowDetected] = useState(0) // bump to re-trigger overlay
  const [wsLive, setWsLive]       = useState(false)  // WebSocket connected
  const isGuestMode = useRef(false)

  const isMutation =
    response?.tier === 'CRITICAL' ||
    response?.force_critical === true

  /* ── Connectivity probe ─────────────────────────── */
  useEffect(() => {
    fetch(`${API_BASE}/api/status`)
      .then(r => r.ok ? setConnected(true) : setConnected(false))
      .catch(() => setConnected(false))
  }, [])

  /* ── WebSocket — real-time audit event push ─────── */
  useEffect(() => {
    const wsUrl = API_BASE.replace(/^http/, 'ws') + '/ws/events'
    const ws = new WebSocket(wsUrl)

    ws.onopen  = () => setWsLive(true)
    ws.onclose = () => setWsLive(false)
    ws.onerror = () => setWsLive(false)

    ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data)
        if (event.type === 'AUDIT_EVENT') {
          setAuditLog(prev => [{
            id:             Date.now(),
            query:          'external-trigger',
            tier:           event.tier,
            recordCount:    event.record_count,
            ts:             new Date().toLocaleTimeString(),
            isMutation:     event.is_mutation,
            narrative:      event.soc_narrative,
            classification: event.soc_classification,
            source:         'LIVE',
          }, ...prev.slice(0, 99)])
          if (event.is_mutation) {
            setResponse({ tier: 'CRITICAL', record_count: event.record_count })
          }
        }
      } catch (_) {}
    }

    return () => ws.close()
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

  /* ── Guest execute (triggers detection overlay for CRITICAL) ── */
  const guestExecute = useCallback(async (params) => {
    isGuestMode.current = true
    await executeQuery(params)
    isGuestMode.current = false
  }, [executeQuery])

  /* ── Watch for CRITICAL result in guest mode ──────────────── */
  useEffect(() => {
    if (isGuestMode.current && isMutation) {
      setShowDetected(n => n + 1)
    }
  }, [response]) // eslint-disable-line react-hooks/exhaustive-deps

  const runDemo = useCallback(async () => {
    await fetch(`${API_BASE}/api/demo/run`, { method: 'POST' })
  }, [])

  if (!authed) {
    return <LoginScreen onLogin={() => setAuthed(true)} />
  }

  return (
    <div className={`min-h-screen bg-slate-900 text-slate-100 flex flex-col select-none
                     ${isMutation ? 'scanline' : ''}`}>

      <Header connected={connected} isMutation={isMutation} wsLive={wsLive} resetDemo={() => setAuditLog([])} onRunDemo={runDemo} />

      <StatusBanner isMutation={isMutation} loading={loading} response={response} />

      <ThreatGraph log={auditLog} />

      <QueryBuilder onExecute={executeQuery} onGuestExecute={guestExecute} loading={loading} />

      {/* ── Split pane ──────────────────────────────── */}
      <div className="flex flex-1 gap-3 p-3 pt-0 overflow-hidden min-h-0" style={{ height: 'calc(100vh - 220px)' }}>
        <PayloadPane
          response={response}
          loading={loading}
          error={error}
          isMutation={isMutation}
          showDetected={showDetected}
        />
        <AuditLog log={auditLog} />
      </div>
    </div>
  )
}
