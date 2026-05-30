# Heisenberg Vault — Architecture

This document describes the internal architecture of Heisenberg Vault: how components
connect, how data flows through the 3-tier routing engine, and how each security primitive
is assembled into a coherent system.

---

## Contents

- [System Overview](#system-overview)
- [Component Map](#component-map)
- [Request Lifecycle](#request-lifecycle)
- [3-Tier Routing Engine](#3-tier-routing-engine)
  - [SURGICAL Path](#surgical-path)
  - [ELEVATED Path](#elevated-path)
  - [CRITICAL Path](#critical-path)
- [LLM Fallback Chain](#llm-fallback-chain)
- [Cryptographic Garbage Generation Pipeline](#cryptographic-garbage-generation-pipeline)
- [Temporal Attack Detection](#temporal-attack-detection)
- [Audit Log Hash Chain](#audit-log-hash-chain)
- [WebSocket Event Flow](#websocket-event-flow)
- [SOC Webhook Alerting](#soc-webhook-alerting)
- [Deployment Architecture](#deployment-architecture)
- [Database Schema](#database-schema)
- [Extension Points](#extension-points)

---

## System Overview

Heisenberg Vault is a three-layer system:

```
┌─────────────────────────────────────────────────────────────┐
│                  React Dashboard (Vercel CDN)               │
│                                                             │
│   LoginScreen  ──►  JWT stored in sessionStorage           │
│   QueryBuilder ──►  REST GET /api/query                    │
│   PayloadPane  ──►  Renders SURGICAL / CRITICAL results    │
│   AuditLog     ──►  REST GET /api/audit (JWT)              │
│   ThreatGraph  ──►  SVG chart from local session state     │
│   Header       ──►  WS /ws/events (LIVE badge)            │
└─────────────────────────┬───────────────────────────────────┘
                          │  HTTPS + WSS
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              FastAPI Application (Render.com)               │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Request Pipeline                                    │  │
│  │                                                      │  │
│  │  RateTracker ──► classify_tier() ──► tier dispatch  │  │
│  │       │                                    │         │  │
│  │       │ (temporal escalation)              │         │  │
│  │       ▼                                    ▼         │  │
│  │  ┌─────────┐   ┌──────────────┐   ┌────────────┐   │  │
│  │  │SURGICAL │   │   ELEVATED   │   │  CRITICAL  │   │  │
│  │  │decrypt  │   │ analyze_intent│   │ obfuscate  │   │  │
│  │  │plaintext│   │ (LLM / heur) │   │ (HMAC key) │   │  │
│  │  └────┬────┘   └──────┬───────┘   └─────┬──────┘   │  │
│  │       │               │                  │          │  │
│  │       └───────────────┼──────────────────┘          │  │
│  │                       │                             │  │
│  │              _make_envelope()                       │  │
│  │              _write_audit_log()   ◄── hash chain    │  │
│  │              timing_pad (150ms)                     │  │
│  │              ws_manager.broadcast()                 │  │
│  │              trigger_soc_alert()                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  Auth layer: verify_token() (HS256 JWT) — audit only       │
└─────────────────────────┬───────────────────────────────────┘
                          │  SQLite / PostgreSQL
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    vault.db (SQLite)                        │
│                                                             │
│  sensitive_records  — 50 Fernet-encrypted medical records  │
│  audit_log          — SHA-256 blockchain hash chain        │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Map

### Backend (`backend/main.py`)

| Component | Class / Function | Responsibility |
|-----------|-----------------|----------------|
| Rate detection | `RateTracker` | Per-IP sliding window — detects temporal sweep patterns |
| Tier router | `classify_tier()` | Maps result count to SURGICAL / ELEVATED / CRITICAL |
| LLM resolver | `_build_llm_client()` | Selects active LLM backend from priority chain |
| SOC analyst | `analyze_intent()` | Calls LLM + heuristic, returns classification |
| LLM caller | `_call_llm_soc()` | OpenAI SDK call with error handling and JSON parsing |
| Heuristic | `_heuristic_classify()` | Pure-math sweep-ratio classifier (no network) |
| Key derivation | `_derive_ephemeral_key()` | Dual-HMAC HKDF-like ephemeral key per record |
| Garbage engine | `_generate_garbage_payload()` | Per-record fake plaintext + ephemeral Fernet encrypt |
| Obfuscation | `_apply_critical_obfuscation()` | Applies garbage engine to all records in sweep |
| Response builder | `_make_envelope()` | Wraps records in uniform JSON envelope |
| Audit writer | `_write_audit_log()` | Appends to SHA-256 hash chain + broadcasts WS event |
| WS manager | `ConnectionManager` | Maintains active WebSocket connections, fan-out broadcast |
| SOC alert | `trigger_soc_alert()` | Async httpx POST to Discord/Slack webhook |
| Auth guard | `verify_token()` | HS256 JWT validation for admin endpoints |

### Database (`backend/database.py`)

| Component | Function | Responsibility |
|-----------|----------|----------------|
| Connection | `get_connection()` | Context manager — returns SQLite or PostgreSQL connection |
| Bootstrap | `init_db()` | Creates tables + seeds 50 mock records on first run |
| Seeder | `_seed_records()` | Generates and inserts 50 deterministic mock profiles |
| Fernet loader | `_load_fernet()` | Loads VAULT_MASTER_KEY from env, falls back to demo key |
| Encrypt | `encrypt_payload()` | Fernet-encrypts a UTF-8 string |
| Decrypt | `decrypt_payload()` | Fernet-decrypts a token, raises ValueError on failure |
| Rotate | `rotate_fernet()` | Hot-swaps the module-level cipher (Heisenberg mutation) |
| PG cursor | `PostgresCursorWrapper` | Translates SQLite `?`/`:param` to Postgres `%s`/`%(param)s` |
| PG connection | `PostgresConnectionWrapper` | Duck-types psycopg2 connection to match sqlite3 API |
| Helpers | `fetch_records_paginated()` | Paginated read with optional decryption |
| Helpers | `fetch_all_ids()` | Returns all record IDs (used by heuristic sweep ratio) |
| Helpers | `count_records()` | Returns total row count |
| Error alias | `DatabaseError` | `sqlite3.Error` or `psycopg2.Error` depending on backend |

### Frontend (`frontend/src/`)

| Component | File | Responsibility |
|-----------|------|----------------|
| Root | `App.jsx` | WebSocket lifecycle, query execution, state management |
| Nav | `Header.jsx` | LIVE badge, demo runner button, benchmark link |
| Status | `StatusBanner.jsx` | Tier name, record count, mutation indicator |
| Query | `QueryBuilder.jsx` | limit/offset form, raw SQL input, GUEST MODE toggle |
| Results | `PayloadPane.jsx` | ADMIN VIEW (real data) / ATTACKER VIEW (garbage) toggle |
| Events | `AuditLog.jsx` | SESSION tab (in-memory) / PERSISTENT tab (REST) with VERIFY CHAIN |
| Graph | `ThreatGraph.jsx` | SVG time-series showing tier distribution across session |
| Auth | `LoginScreen.jsx` | Username/password form → JWT storage in sessionStorage |

---

## Request Lifecycle

Every request to `GET /api/query` follows this exact sequence:

```
1.  Request arrives at FastAPI
2.  caller_ip extracted from request.client.host
3.  request_nonce = secrets.token_bytes(16)   ← per-request entropy
4.  t_start = time.perf_counter()

5.  Resolve raw records:
    ├── sql parameter → _execute_query(sql)     [SQL validation + execution]
    ├── id parameter  → direct DB lookup        [single record by PK]
    └── default       → fetch_records_paginated [limit + offset]

6.  count = len(raw_records)
7.  tier = classify_tier(count)

8.  Temporal check: _rate_tracker.record(caller_ip, count)
    └── if True and tier != CRITICAL → escalate tier to CRITICAL, prefix "[PATTERN]"

9.  if count == 0:
    └── return SURGICAL envelope with note, skip steps 10–14

10. Timing pad:
    └── if elapsed < 150ms → asyncio.sleep(150ms - elapsed + jitter(10–50ms))

11. Tier dispatch:
    ├── SURGICAL  → decrypt each protected_payload with master Fernet key
    ├── ELEVATED  → analyze_intent(records, context)
    │               ├── LLM: _call_llm_soc(query_description)
    │               │   ├── SURGICAL classification → partial reveal (60%)
    │               │   └── MASS_SURVEILLANCE      → escalate to CRITICAL obfuscation
    │               └── heuristic: _heuristic_classify(records)
    └── CRITICAL  → _apply_critical_obfuscation(records, request_nonce)

12. _write_audit_log(caller_ip, query_str, tier, count, soc_*)
    └── also broadcasts AUDIT_EVENT to all WebSocket clients

13. if tier == CRITICAL: trigger_soc_alert() [async, fire-and-forget]

14. return JSONResponse(_make_envelope(...))
```

---

## 3-Tier Routing Engine

### SURGICAL Path

```
count < 5
    │
    ▼
for each record:
    decrypt_payload(row["protected_payload"])  ← VAULT_MASTER_KEY Fernet
    └── on failure: replace with "[DECRYPTION FAILED]"
    │
    ▼
_make_envelope(tier="SURGICAL", clearance="FULL", records=decrypted)
```

The master Fernet cipher is a module-level singleton loaded once at startup from
`VAULT_MASTER_KEY`. All 50 seeded records were encrypted with this key at database
initialisation time. SURGICAL is the only tier that calls this cipher for decryption.

### ELEVATED Path

```
5 ≤ count ≤ 10
    │
    ▼
build query_description:
    "SQL: {sql} | records_returned={n} | record_ids={ids} | caller_ip={ip}"
    │
    ▼
analyze_intent(records, context):
    │
    ├── if _LLM_BACKEND == "heuristic" ──────────────────────────────────┐
    │                                                                     │
    └── else: _call_llm_soc(query_description)                          │
              │                                                           │
              ├── success: parse JSON → classification                   │
              │                                                           │
              └── failure or null: fall through to heuristic ───────────┘
                                                                         │
                                                    _heuristic_classify(records)
                                                    sweep_ratio = len(ids) / total_vault
                                                    if ratio >= 0.30 → MASS_SURVEILLANCE
                                                    else             → SURGICAL
    │
    ▼
if force_critical:
    _apply_critical_obfuscation(records, request_nonce)
    └── _make_envelope(tier="CRITICAL", clearance="FULL", _soc_* fields)

else (SURGICAL from LLM):
    for each record: show first 60% of plaintext lines + redaction notice
    └── _make_envelope(tier="ELEVATED", classification, confidence, narrative)
```

### CRITICAL Path

```
count > 10  (or temporal escalation, or ELEVATED escalation)
    │
    ▼
_apply_critical_obfuscation(records, request_nonce):
    for each record:
        _generate_garbage_payload(record_id, request_nonce)
            │
            ├── per_record_salt = SHA-256(request_nonce ‖ record_id.to_bytes(4,"big"))
            ├── ephemeral_key   = _derive_ephemeral_key(per_record_salt)
            │       ├── step1 = HMAC-SHA256(SESSION_ENTROPY, salt)
            │       └── step2 = HMAC-SHA256(step1, b"heisenberg-mutation")
            │           └── return base64url(step2)
            ├── fake_plaintext = "HVLT-{hex}:{hex}:{hex}\nMUT-EPOCH:{ts}\n..."
            └── return Fernet(ephemeral_key).encrypt(fake_plaintext)
    │
    ▼
_make_envelope(
    tier="CRITICAL",
    clearance="FULL",
    encryption_algo="Fernet/AES-128-CBC",
    note="Bulk payload export completed successfully.",
    records=obfuscated
)
```

---

## LLM Fallback Chain

The LLM backend is resolved **once at startup** by `_build_llm_client()` and cached as
`(_LLM_BACKEND, _LLM_CLIENT)`. All ELEVATED queries use the same backend for the lifetime
of the process.

```
_build_llm_client() resolution order:

1. OLLAMA_MODEL env var set?
   └─ YES → AsyncOpenAI(base_url="{OLLAMA_HOST}/v1", api_key="ollama")
             backend = "ollama", model = OLLAMA_MODEL
             ▼ DONE

2. LM_STUDIO_MODEL env var set?
   └─ YES → AsyncOpenAI(base_url="{LM_STUDIO_HOST}/v1", api_key="lm-studio")
             backend = "lmstudio", model = LM_STUDIO_MODEL
             ▼ DONE

3. Walk _LLM_REGISTRY (first set API key wins):
   ┌─────────────────┬────────────────────────────────────┬──────────────────────────┐
   │ Env var         │ Base URL                           │ Model                    │
   ├─────────────────┼────────────────────────────────────┼──────────────────────────┤
   │ KIMI_API_KEY    │ https://api.moonshot.cn/v1         │ moonshot-v1-8k           │
   │ GROQ_API_KEY    │ https://api.groq.com/openai/v1     │ llama-3.3-70b-versatile  │
   │ OPENROUTER_KEY  │ https://openrouter.ai/api/v1       │ qwen/qwq-32b:free        │
   │ OPENAI_API_KEY  │ (default OpenAI base URL)          │ gpt-4o-mini              │
   └─────────────────┴────────────────────────────────────┴──────────────────────────┘
   └─ first match → AsyncOpenAI(api_key=key, base_url=url)
                    backend = registry name, model = registry model
                    ▼ DONE

4. No keys set → backend = "heuristic", client = None
```

**Runtime fallback during ELEVATED analysis:**

```
_call_llm_soc(query_description):
    │
    ├── LLM call succeeds → parse JSON
    │       ├── valid classification → return {classification, confidence, narrative}
    │       └── invalid JSON or unexpected classification → return {classification: null}
    │
    └── LLM call fails (network, rate limit, etc.) → return {classification: null}

analyze_intent():
    ├── soc = _call_llm_soc(...)
    └── if soc["classification"] is None → soc = _heuristic_classify(records)
```

The heuristic is always available regardless of network state, making the ELEVATED tier
100% available even during complete LLM provider outages.

---

## Cryptographic Garbage Generation Pipeline

Step-by-step for a single record in a 30-record CRITICAL sweep:

```
Input: record_id = 7, request_nonce = b"\x3f\xa2...\x8b" (16 bytes)

Step 1 — Per-record salt
─────────────────────────────────────────────────────
per_record_salt = SHA-256(
    b"\x3f\xa2...\x8b"  +  (7).to_bytes(4, "big")
)
→ 32-byte deterministic salt unique to this request + this record

Step 2 — HMAC Round 1 (key binding)
─────────────────────────────────────────────────────
step1 = HMAC-SHA256(
    key  = SESSION_ENTROPY,       # 32 random bytes, server startup only
    msg  = per_record_salt
)
→ 32 bytes — bound to this deployment + this request + this record

Step 3 — HMAC Round 2 (domain separation)
─────────────────────────────────────────────────────
step2 = HMAC-SHA256(
    key  = step1,
    msg  = b"heisenberg-mutation"
)
→ 32 bytes — separated from any other security domain by the label

Step 4 — Fernet key encoding
─────────────────────────────────────────────────────
ephemeral_key = base64url(step2)
→ "abc123...xyz=" — a valid 44-character Fernet key string

Step 5 — Fake plaintext construction
─────────────────────────────────────────────────────
fake_plaintext = """
HVLT-3FA2:8B4C2D1E:9F3A
MUT-EPOCH:1748650000
SALT:3fa28b4c2d1e9f3a7c2b5d8e
RECORD-HASH:a3f8d2c1e4b7a9f0c2d5e8b1a4f7d0c3...
PAYLOAD:7f3a9b2c5d8e1f4a7c0b3f6a9e2c5d8b1a4f7d0c3e6a9b2...
CHECKSUM:c5d8e1f4a7c0b3f6
"""
← medical-record-shaped fields — plausible structure, unverifiable content

Step 6 — Fernet encryption
─────────────────────────────────────────────────────
garbage_token = Fernet(ephemeral_key).encrypt(fake_plaintext.encode())
→ "gAAAAABmX7k2q4VtZ3..." — structurally valid Fernet token

Step 7 — Record replacement
─────────────────────────────────────────────────────
row["protected_payload"] = garbage_token.decode()
← indistinguishable from a real Fernet-encrypted medical record payload

Output: row with garbage token in protected_payload field
```

The full pipeline runs for every record in the sweep. With 30 records and `n=7`:
- 30 unique per-record salts
- 30 unique ephemeral keys (different `record_id` in each salt)
- 30 unique garbage tokens (different keys + fresh Fernet IV + fresh HMAC)
- All tokens in a single request share `request_nonce` — the same sweep always
  produces different tokens (nonce is random per request)

---

## Temporal Attack Detection

The `RateTracker` class is a per-IP in-memory sliding window:

```
State per IP: deque of (timestamp, record_count) tuples

On each query:
    1. Evict entries older than 60 seconds
    2. Append (now, record_count)
    3. Compute:
       - query_count    = len(deque)
       - total_records  = sum(r for _, r in deque)
    4. Return True if query_count >= 5 OR total_records >= 15

In query_records():
    is_temporal_attack = _rate_tracker.record(caller_ip, count)
    if is_temporal_attack and tier != CRITICAL:
        tier = CRITICAL
        query_str = "[PATTERN]" + query_str   # audit log marker only
```

The `[PATTERN]` prefix is stored in the audit log's `query_fingerprint` field (as a hash
of the prefixed string), making pattern-escalated events distinguishable in SOC reviews
without exposing the reason to the attacker.

---

## Audit Log Hash Chain

The audit log is an append-only blockchain-style chain stored in the `audit_log` table.

```
Insertion sequence for a new log entry:

1. SELECT row_hash FROM audit_log ORDER BY id DESC LIMIT 1
   └── prev_hash = result["row_hash"]  OR  "HEISENBERG_GENESIS" (if table empty)

2. Construct data string:
   data = (
       timestamp +
       caller_ip +
       SHA-256(query_str)  [query_fingerprint] +
       tier +
       str(record_count) +
       (soc_classification or "") +
       str(soc_confidence or "") +
       (soc_narrative or "") +
       prev_hash
   )

3. row_hash = SHA-256(data.encode("utf-8"))

4. INSERT INTO audit_log (..., prev_hash, row_hash) VALUES (...)

Verification (GET /api/audit/verify):

   expected_prev = "HEISENBERG_GENESIS"
   for row in SELECT * FROM audit_log ORDER BY id ASC:
       if row["prev_hash"] != expected_prev → CHAIN BROKEN at row["id"]
       computed = SHA-256(reconstruct_data(row))
       if computed != row["row_hash"]       → CHAIN BROKEN at row["id"]
       expected_prev = row["row_hash"]
   → chain_valid = True
```

---

## WebSocket Event Flow

```
Client connects to /ws/events:
    ws_manager.connect(websocket)
    └── appends to active_connections list

Every _write_audit_log() call:
    event = {
        "type":               "AUDIT_EVENT",
        "tier":               tier,
        "record_count":       count,
        "timestamp":          timestamp,
        "caller_ip":          caller_ip,
        "soc_classification": soc_classification,
        "soc_narrative":      soc_narrative,
        "is_mutation":        (tier == "CRITICAL")
    }

    loop = asyncio.get_event_loop()
    if loop.is_running():
        loop.create_task(ws_manager.broadcast(event))

ws_manager.broadcast(event):
    for connection in active_connections:
        try:
            await connection.send_text(json.dumps(event))
        except Exception:
            dead.append(connection)
    for d in dead: active_connections.remove(d)

Client disconnect:
    ws_manager.disconnect(websocket)
    └── removes from active_connections

Keep-alive:
    client sends any text frame (e.g. "ping")
    server reads and discards via: await websocket.receive_text()
```

The broadcast is non-blocking from the perspective of the HTTP response — it is launched
as a `create_task()` coroutine after `conn.commit()` completes, so audit writes are
durable before the broadcast fires.

---

## SOC Webhook Alerting

On every CRITICAL tier activation (direct or ELEVATED escalation):

```
trigger_soc_alert(tier, classification, narrative, caller_ip):

1. if SOC_WEBHOOK_URL is not set:
   log.warning("Webhook URL not configured. Skipping alert.")
   return

2. Construct Discord/Slack payload:
   {
     "content": "🚨 ALERT: Heisenberg Vault Mutation Triggered",
     "embeds": [{
       "title": "Threat Level: CRITICAL",
       "color": 16711680,   ← red
       "fields": [
         {"name": "Classification", "value": classification},
         {"name": "Source IP",      "value": caller_ip},
         {"name": "AI Narrative",   "value": narrative}
       ],
       "timestamp": ISO-8601
     }]
   }

3. async with httpx.AsyncClient() as client:
       await client.post(SOC_WEBHOOK_URL, json=payload, timeout=5.0)

4. On any exception: log.error(...) — never raises to caller
```

The alert is dispatched *after* the HTTP response has been returned to the attacker.
The attacker-facing response time is not affected by webhook latency or failure.

---

## Deployment Architecture

### Local Development (Docker Compose)

```
docker-compose up --build
    │
    ├── heisenberg-backend (container)
    │   ├── Image: ./backend/Dockerfile
    │   ├── Port:  8000:8000
    │   ├── Env:   VAULT_MASTER_KEY, OLLAMA_*, LLM API keys
    │   └── Volume: ./vault.db:/app/vault.db  (persistent DB across restarts)
    │
    └── heisenberg-frontend (container)
        ├── Image: ./frontend/Dockerfile (target: builder)
        ├── Port:  5173:5173
        ├── Env:   VITE_API_BASE=http://localhost:8000
        └── Volume: ./frontend:/app (hot-reload)

Ollama (optional, host machine):
    ollama serve → http://host.docker.internal:11434
    OLLAMA_HOST=http://host.docker.internal:11434
```

### Production (Render + Vercel)

```
GitHub (main branch push)
    │
    ├── Render.com (auto-deploy on push)
    │   ├── Config: render.yaml
    │   ├── Build:  pip install -r requirements.txt
    │   ├── Start:  uvicorn backend.main:app --host 0.0.0.0 --port $PORT
    │   ├── Health: GET /api/status
    │   └── Secrets (Render dashboard, not in repo):
    │       VAULT_MASTER_KEY  → auto-generated
    │       VAULT_JWT_SECRET  → auto-generated
    │       GROQ_API_KEY      → manual
    │       FRONTEND_URL      → https://*.vercel.app
    │
    └── Vercel (auto-deploy on push)
        ├── Config: frontend/vercel.json
        ├── Build:  npm run build
        ├── Output: dist/
        ├── Env:    VITE_API_BASE=https://heisenberg-vault-backend.onrender.com
        └── CDN:    global edge distribution

CORS (FastAPI CORSMiddleware):
    allow_origins = [
        "http://localhost:3000",
        "http://localhost:5173",
        "https://*.vercel.app",
        "https://*.onrender.com",
        FRONTEND_URL
    ]
```

---

## Database Schema

### `sensitive_records`

```sql
-- SQLite
CREATE TABLE sensitive_records (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    name                TEXT    NOT NULL,
    email               TEXT    NOT NULL UNIQUE,
    medical_record_id   TEXT    NOT NULL UNIQUE,
    protected_payload   TEXT    NOT NULL    -- Fernet-encrypted at rest
);

-- PostgreSQL (POSTGRES_URL set)
CREATE TABLE sensitive_records (
    id                  SERIAL PRIMARY KEY,
    name                TEXT    NOT NULL,
    email               TEXT    NOT NULL UNIQUE,
    medical_record_id   TEXT    NOT NULL UNIQUE,
    protected_payload   TEXT    NOT NULL
);
```

### `audit_log`

```sql
CREATE TABLE audit_log (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,  -- SERIAL for Postgres
    timestamp           TEXT    NOT NULL,
    caller_ip           TEXT    NOT NULL,
    query_fingerprint   TEXT    NOT NULL,   -- SHA-256 of raw query string
    tier                TEXT    NOT NULL,   -- SURGICAL | ELEVATED | CRITICAL
    record_count        INTEGER NOT NULL,
    soc_classification  TEXT,               -- SURGICAL | MASS_SURVEILLANCE | null
    soc_confidence      REAL,               -- 0.0–1.0 | null
    soc_narrative       TEXT,               -- LLM explanation | null
    prev_hash           TEXT    NOT NULL,   -- hash chain link
    row_hash            TEXT    NOT NULL    -- SHA-256 of this row's data + prev_hash
);
```

---

## Extension Points

### PostgreSQL Adapter (implemented)

Set `POSTGRES_URL` to any PostgreSQL-compatible connection string:

```bash
export POSTGRES_URL="postgresql://user:pass@host:5432/vault"
```

The `PostgresCursorWrapper` and `PostgresConnectionWrapper` in `database.py`
automatically translate:
- SQLite `?` bind parameters → Postgres `%s`
- SQLite `:param` named parameters → Postgres `%(param)s`
- SQLite `INTEGER PRIMARY KEY AUTOINCREMENT` → Postgres `SERIAL PRIMARY KEY`
- `sqlite3.Row` dict-like access → `psycopg2.extras.RealDictCursor`

No changes to `main.py` are required. `DatabaseError` automatically aliases to
`psycopg2.Error` when `POSTGRES_URL` is set.

### New LLM Backend

Append a tuple to `_LLM_REGISTRY` in `main.py`:

```python
(
    "YOUR_API_KEY_ENV_VAR",            # env var name
    "https://api.provider.com/v1",     # OpenAI-compatible base URL
    "your-model-name",                 # model string
    "your-backend-id",                 # internal label
    "Provider model-name [tier]",      # log label
),
```

The backend must implement the OpenAI chat completions API. No other changes needed.

### pip Package (`heisenberg-vault`)

The architecture is designed for extraction as a pip-installable middleware:

```python
from heisenberg_vault import Vault

vault = Vault(master_key=os.getenv("VAULT_MASTER_KEY"))

@app.get("/records")
async def get_records(limit: int = 5):
    records = db.query(limit=limit)
    return vault.respond(records, request)
```

Planned package structure:
```
heisenberg_vault/
├── __init__.py          # Vault class + respond() method
├── tiers.py             # classify_tier() + RateTracker
├── crypto.py            # _derive_ephemeral_key() + _generate_garbage_payload()
├── audit.py             # _write_audit_log() + hash chain
├── soc.py               # analyze_intent() + _LLM_REGISTRY + trigger_soc_alert()
└── adapters/
    ├── sqlite.py        # current database.py
    └── postgres.py      # psycopg2 adapter
```

### Rate Tracker — Redis Backend

Replace the in-memory `_store: dict[str, deque]` with a Redis sorted set for cross-replica
shared state:

```python
import redis.asyncio as aioredis

redis = aioredis.Redis(host=REDIS_HOST)

async def record(self, ip: str, record_count: int) -> bool:
    key = f"vault:rate:{ip}"
    now = time.time()
    await redis.zadd(key, {str(now): now})
    await redis.expire(key, self.window)
    count = await redis.zcard(key)
    return count >= self.max_queries
```

---

*Heisenberg Vault Architecture — v1.0.0*
*Built by Pentogram Team for Codorra 2026 — Unstop Hackathon*
