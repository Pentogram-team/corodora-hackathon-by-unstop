# Heisenberg Vault — API Reference

> **Security design note:** Every endpoint always returns HTTP 200 — including CRITICAL tier
> responses where the data has been mutated to cryptographic garbage. This is intentional.
> The vault never signals detection to callers. There are no tells.

---

## Contents

- [Base URLs](#base-urls)
- [Authentication](#authentication)
- [Response Envelope](#response-envelope)
- [Endpoints](#endpoints)
  - [POST /api/auth/login](#post-apiauthlogin)
  - [GET /api/query](#get-apiquery)
  - [GET /api/audit](#get-apiaudit)
  - [GET /api/audit/verify](#get-apiauditverify)
  - [GET /api/status](#get-apistatus)
  - [GET /api/health](#get-apihealth)
  - [GET /api/tiers](#get-apitiers)
  - [GET /api/benchmark](#get-apibenchmark)
  - [POST /api/demo/run](#post-apidemorun)
  - [WebSocket /ws/events](#websocket-wsevents)
- [Error Reference](#error-reference)
- [cURL Cheat Sheet](#curl-cheat-sheet)
- [Tier Classification Logic](#tier-classification-logic)

---

## Base URLs

| Environment | URL |
|-------------|-----|
| Local (Docker) | `http://localhost:8000` |
| Local (manual) | `http://127.0.0.1:8000` |
| Production (Render) | `https://heisenberg-vault-backend.onrender.com` |
| Interactive docs | `{base_url}/docs` |
| ReDoc | `{base_url}/redoc` |

---

## Authentication

Admin-only endpoints require a JWT Bearer token. Obtain one from
[`POST /api/auth/login`](#post-apiauthlogin) and include it in every subsequent request:

```
Authorization: Bearer <token>
```

Tokens are signed with HS256, issued for `sub: vault_admin`, and expire after **3600 seconds
(1 hour)**. Expired tokens return `401`.

### Endpoint auth requirements

| Endpoint | Auth |
|----------|------|
| `POST /api/auth/login` | None |
| `GET /api/query` | None |
| `GET /api/status` | None |
| `GET /api/health` | None |
| `GET /api/tiers` | None |
| `GET /api/benchmark` | None |
| `POST /api/demo/run` | None |
| `WS /ws/events` | None |
| `GET /api/audit` | **JWT required** |
| `GET /api/audit/verify` | **JWT required** |

---

## Response Envelope

All `/api/query` responses — across all three tiers — share the same outer envelope structure.
This uniformity is deliberate: the attacker cannot distinguish tiers by shape alone.

```
{
  "status":        "ok",
  "tier":          "SURGICAL" | "ELEVATED" | "CRITICAL",
  "record_count":  <int>,
  "query_time_ms": <float>,
  "timestamp":     "<ISO 8601 UTC>",
  "records":       [ <record>, ... ],
  ...tier-specific extra fields...
}
```

The `records` array always contains the same schema:

```
{
  "id":                 <int>,
  "name":               <string>,
  "email":              <string>,
  "medical_record_id":  <string>,
  "protected_payload":  <string>
}
```

In SURGICAL responses, `protected_payload` is decrypted plaintext.
In ELEVATED responses, it is 60% plaintext with a redaction notice appended.
In CRITICAL responses, it is a structurally valid Fernet token that will never decrypt.

---

## Endpoints

---

### POST /api/auth/login

Authenticate as the vault admin and receive a signed JWT token.

**Auth:** None

**Request body** (`application/json`):

```json
{
  "username": "vault_admin",
  "password": "heisenberg2026"
}
```

**Response 200 — success:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ2YXVsdF9hZG1pbiIsImlhdCI6MTcxNzE0MDAwMCwiZXhwIjoxNzE3MTQzNjAwfQ.abc123",
  "expires_in": 3600
}
```

| Field | Type | Description |
|-------|------|-------------|
| `token` | `string` | HS256-signed JWT. Include as `Authorization: Bearer <token>`. |
| `expires_in` | `int` | Seconds until the token expires. Always `3600`. |

**Response 401 — bad credentials:**

```json
{
  "detail": "Invalid credentials"
}
```

> **Security note:** The vault does not rate-limit login attempts at the API level. Deploy
> behind a reverse proxy (Nginx, Cloudflare) for brute-force protection in production.

---

### GET /api/query

The core Heisenberg Vault endpoint. Routes every request through the 3-tier classification
engine and returns HTTP 200 regardless of which tier fires.

**Auth:** None (intentionally public — attackers must be able to reach this endpoint)

**Query parameters:**

| Parameter | Type | Default | Constraints | Description |
|-----------|------|---------|-------------|-------------|
| `limit` | `int` | `5` | `1 – 50` | Max records to return. Ignored when `sql` is provided. |
| `offset` | `int` | `0` | `≥ 0` | Pagination offset. Ignored when `sql` is provided. |
| `id` | `int` | — | `≥ 1` | Fetch a single record by primary key. Bypasses limit/offset. |
| `sql` | `string` | — | `≤ 1024 chars` | Raw `SELECT` against `sensitive_records`. DML/DDL is blocked. |

**Tier routing:**

| Tier | Condition | Protected payload |
|------|-----------|-------------------|
| `SURGICAL` | `count < 5` | Fully decrypted plaintext |
| `ELEVATED` | `5 ≤ count ≤ 10` | 60% plaintext + SOC analysis metadata |
| `CRITICAL` | `count > 10` or AI escalation | Structurally valid Fernet garbage |

**Temporal escalation:** An independent `RateTracker` also monitors per-IP sliding windows
(60-second, 5-query / 15-record thresholds). If triggered, any tier is silently escalated
to `CRITICAL` regardless of result count. The `query_str` is prefixed with `[PATTERN]` in
the audit log but not in the response.

---

#### SURGICAL response (count < 5)

```json
{
  "status": "ok",
  "tier": "SURGICAL",
  "record_count": 1,
  "query_time_ms": 2.341,
  "timestamp": "2026-05-31T10:23:45.123456+00:00",
  "clearance": "FULL",
  "records": [
    {
      "id": 1,
      "name": "Alice Chen",
      "email": "alice.chen@hospital.example",
      "medical_record_id": "MR-2024-001",
      "protected_payload": "Patient: Alice Chen\nDOB: 1985-03-12\nDiagnosis: Hypertension (ICD-10: I10)\nTreating physician: Dr. Sarah Novak\nAdmission: 2024-01-15\nDischarge: 2024-01-18\nNotes: Blood pressure controlled with Lisinopril 10mg."
    }
  ]
}
```

Extra fields for SURGICAL tier:

| Field | Type | Description |
|-------|------|-------------|
| `clearance` | `"FULL"` | Confirms complete decryption. Present on all SURGICAL responses. |

---

#### ELEVATED response — SURGICAL classification (5 ≤ count ≤ 10)

When the AI SOC Analyst classifies the query as `SURGICAL`, a 60% partial reveal is returned.

```json
{
  "status": "ok",
  "tier": "ELEVATED",
  "record_count": 7,
  "query_time_ms": 312.487,
  "timestamp": "2026-05-31T10:24:01.456789+00:00",
  "classification": "SURGICAL",
  "confidence": 0.82,
  "narrative": "Query targets 7 records from a contiguous ID range — consistent with a legitimate ward audit. No IP-range sweep pattern detected. Confidence: 82%.",
  "llm_backend": "groq",
  "force_critical": false,
  "records": [
    {
      "id": 3,
      "name": "Carol Davies",
      "email": "carol.davies@hospital.example",
      "medical_record_id": "MR-2024-003",
      "protected_payload": "Patient: Carol Davies\nDOB: 1972-07-04\nDiagnosis: Type 2 Diabetes (ICD-10: E11)\nTreating physician: Dr. Mark Patel\n[... ELEVATED CLEARANCE REQUIRED FOR FULL RECORD ...]"
    }
  ]
}
```

Extra fields for ELEVATED (SURGICAL classification):

| Field | Type | Description |
|-------|------|-------------|
| `classification` | `"SURGICAL"` | LLM classification result. |
| `confidence` | `float` | Classifier confidence, 0.0–1.0. |
| `narrative` | `string` | LLM-generated explanation of the classification decision. |
| `llm_backend` | `string` | Which backend produced the classification. See [LLM backends](#llm-backends). |
| `force_critical` | `false` | Always `false` on the SURGICAL path. |

---

#### ELEVATED response — MASS_SURVEILLANCE escalation

When the AI SOC Analyst classifies the query as `MASS_SURVEILLANCE`, the request is silently
escalated to CRITICAL. The response shape is identical to a direct CRITICAL response.

```json
{
  "status": "ok",
  "tier": "CRITICAL",
  "record_count": 8,
  "query_time_ms": 198.032,
  "timestamp": "2026-05-31T10:24:08.111222+00:00",
  "clearance": "FULL",
  "encryption_algo": "Fernet/AES-128-CBC",
  "key_version": "v1",
  "note": "Bulk payload export completed successfully.",
  "_soc_classification": "MASS_SURVEILLANCE",
  "_soc_confidence": 0.94,
  "_soc_backend": "groq",
  "records": [
    {
      "id": 1,
      "name": "Alice Chen",
      "email": "alice.chen@hospital.example",
      "medical_record_id": "MR-2024-001",
      "protected_payload": "gAAAAABmX7k2q4...NzU5YWQ="
    }
  ]
}
```

> **Dashboard vs. attacker:** The `_soc_*` fields (underscore-prefixed) are included in the
> JSON and visible to the admin dashboard. An automated attacker parsing the response is
> unlikely to inspect underscore-prefixed fields. They are not exposed in the CRITICAL
> (count-triggered) path — only on the ELEVATED→CRITICAL escalation path.

---

#### CRITICAL response — direct (count > 10)

```json
{
  "status": "ok",
  "tier": "CRITICAL",
  "record_count": 30,
  "query_time_ms": 187.254,
  "timestamp": "2026-05-31T10:24:15.789012+00:00",
  "clearance": "FULL",
  "encryption_algo": "Fernet/AES-128-CBC",
  "key_version": "v1",
  "note": "Bulk payload export completed successfully.",
  "records": [
    {
      "id": 1,
      "name": "Alice Chen",
      "email": "alice.chen@hospital.example",
      "medical_record_id": "MR-2024-001",
      "protected_payload": "gAAAAABmX7k2q4VtZ3JhZ...permanently-undecryptable-fernet-token...NzU5YWQ="
    },
    {
      "id": 2,
      "name": "Bob Martinez",
      "email": "bob.martinez@hospital.example",
      "medical_record_id": "MR-2024-002",
      "protected_payload": "gAAAAABmX7k2p9WuA1SbC...different-ephemeral-key-per-record...Qk1ZZA=="
    }
  ]
}
```

Extra fields for CRITICAL tier:

| Field | Type | Description |
|-------|------|-------------|
| `clearance` | `"FULL"` | Deliberately reassuring. Tells the attacker they received everything. |
| `encryption_algo` | `"Fernet/AES-128-CBC"` | Accurate description of the token format — the deception is structural, not format-level. |
| `key_version` | `"v1"` | Placeholder key version. Real key rotations are tracked separately. |
| `note` | `string` | `"Bulk payload export completed successfully."` — the attacker's success message. |

> **Cryptographic note:** Each record's `protected_payload` is encrypted with a unique
> ephemeral key derived via:
> `HMAC(HMAC(SESSION_ENTROPY, nonce ‖ record_id), b"heisenberg-mutation")`
>
> `SESSION_ENTROPY` is 32 random bytes generated at server startup. It is never stored.
> The tokens are structurally indistinguishable from real Fernet ciphertext and will pass
> all format validation checks. They cannot be decrypted without `SESSION_ENTROPY`, which
> changes on every server restart.

---

#### Empty result response

When the query matches zero records, the vault returns SURGICAL regardless of requested limit.

```json
{
  "status": "ok",
  "tier": "SURGICAL",
  "record_count": 0,
  "query_time_ms": 1.812,
  "timestamp": "2026-05-31T10:24:22.000000+00:00",
  "note": "No records matched the query.",
  "records": []
}
```

---

#### SQL injection blocking

When `sql` contains blocked keywords (`DROP`, `DELETE`, `UPDATE`, `INSERT`, `ALTER`,
`CREATE`, `ATTACH`, `DETACH`, `PRAGMA`, `VACUUM`) or does not reference `sensitive_records`:

```json
{
  "detail": "Query contains blocked keywords. Only SELECT is permitted."
}
```

```json
{
  "detail": "Query must reference the `sensitive_records` table."
}
```

> These are the only `4xx` responses the vault emits. They apply only to structurally
> invalid SQL — not to surveillance-scale queries, which always receive HTTP 200.

---

### GET /api/audit

Returns the last 100 audit log entries, newest first. Every query — SURGICAL, ELEVATED, or
CRITICAL — is recorded.

**Auth:** JWT required

**Response 200:**

```json
[
  {
    "id": 47,
    "timestamp": "2026-05-31T10:24:15.789012+00:00",
    "caller_ip": "203.0.113.42",
    "query_fingerprint": "a3f8d2c1e4b7a9f0c2d5e8b1a4f7d0c3e6a9b2c5f8e1a4d7c0b3f6a9e2c5d8b1",
    "tier": "CRITICAL",
    "record_count": 30,
    "soc_classification": "MASS_SURVEILLANCE",
    "soc_confidence": 0.97,
    "soc_narrative": "Heuristic: query sweeps 60% of the vault — consistent with bulk data harvesting.",
    "prev_hash": "c1a2b3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
    "row_hash": "f0e1d2c3b4a5f6e7d8c9b0a1f2e3d4c5b6a7f8e9d0c1b2a3f4e5d6c7b8a9f0e1"
  },
  {
    "id": 46,
    "timestamp": "2026-05-31T10:23:45.123456+00:00",
    "caller_ip": "127.0.0.1",
    "query_fingerprint": "b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3",
    "tier": "SURGICAL",
    "record_count": 1,
    "soc_classification": null,
    "soc_confidence": null,
    "soc_narrative": "Clean plaintext lookup.",
    "prev_hash": "HEISENBERG_GENESIS",
    "row_hash": "c1a2b3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2"
  }
]
```

**Audit log field reference:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `int` | Auto-incrementing primary key. |
| `timestamp` | `string` | ISO 8601 UTC timestamp of the query. |
| `caller_ip` | `string` | Source IP address of the request. |
| `query_fingerprint` | `string` | SHA-256 of the raw query string. Not reversible. |
| `tier` | `string` | `SURGICAL`, `ELEVATED`, or `CRITICAL`. |
| `record_count` | `int` | Number of records the query matched. |
| `soc_classification` | `string \| null` | LLM classification for ELEVATED queries. `null` for SURGICAL/CRITICAL. |
| `soc_confidence` | `float \| null` | Classifier confidence, 0.0–1.0. `null` when no LLM fired. |
| `soc_narrative` | `string \| null` | LLM narrative or internal note. |
| `prev_hash` | `string` | SHA-256 of the previous row's data (hash chain). First entry is `HEISENBERG_GENESIS`. |
| `row_hash` | `string` | SHA-256 of this row's data concatenated with `prev_hash`. |

> **Hash chain formula:**
> `row_hash = SHA-256(timestamp + caller_ip + query_fingerprint + tier + record_count +`
> `soc_classification + soc_confidence + soc_narrative + prev_hash)`

---

### GET /api/audit/verify

Traverse the complete audit hash chain and verify its integrity. Detects any row that has
been deleted, modified, or injected retroactively.

**Auth:** JWT required

**Response 200 — chain intact:**

```json
{
  "chain_valid": true,
  "total_entries": 47,
  "first_broken_at": null
}
```

**Response 200 — tampering detected:**

```json
{
  "chain_valid": false,
  "total_entries": 47,
  "first_broken_at": 23
}
```

| Field | Type | Description |
|-------|------|-------------|
| `chain_valid` | `bool` | `true` if all row hashes are consistent. |
| `total_entries` | `int` | Total rows traversed. |
| `first_broken_at` | `int \| null` | Row `id` of the first integrity violation, or `null` if none. |

> **Genesis block:** The first audit entry uses `prev_hash = "HEISENBERG_GENESIS"`. If this
> sentinel is missing or altered, `first_broken_at` will be `1`.

---

### GET /api/status

Returns operational statistics without touching encrypted payload data. Safe to call
frequently for monitoring dashboards.

**Auth:** None

**Response 200:**

```json
{
  "status": "operational",
  "total_records": 50,
  "active_key_id": "a3f8d2c1e4b7a9f0",
  "tiers": {
    "SURGICAL": "count < 5  → full decrypt",
    "ELEVATED": "5 ≤ count ≤ 10 → partial redact + intent analysis",
    "CRITICAL": "count > 10 → cryptographic obfuscation (HTTP 200)"
  },
  "timestamp": "2026-05-31T10:25:00.000000+00:00"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | `string` | Always `"operational"` when the service is up. |
| `total_records` | `int` | Total rows in `sensitive_records`. |
| `active_key_id` | `string` | First 16 hex chars of SHA-256 of the active Fernet signing key. Changes after key rotation. |
| `tiers` | `object` | Human-readable tier routing summary. |
| `timestamp` | `string` | ISO 8601 UTC. |

---

### GET /api/health

Full-stack health probe. Used by Render.com as the `healthCheckPath` configured in
`render.yaml`. Returns `healthy` when the database is reachable.

**Auth:** None

**Response 200 — healthy:**

```json
{
  "status": "healthy",
  "backend": "operational",
  "database": "connected",
  "records": 50,
  "llm_backend": "groq",
  "version": "1.0.0",
  "environment": "production"
}
```

**Response 200 — database error (service still returns 200):**

```json
{
  "status": "healthy",
  "backend": "operational",
  "database": "error",
  "records": -1,
  "llm_backend": "heuristic",
  "version": "1.0.0",
  "environment": "production"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `database` | `string` | `"connected"` or `"error"`. |
| `records` | `int` | Total records, or `-1` on database error. |
| `llm_backend` | `string` | Active LLM backend name. See [LLM backends](#llm-backends). |
| `environment` | `string` | `"production"` when `RENDER` env var is set, else `"development"`. |

---

### GET /api/tiers

Returns the tier classification rules as structured JSON. Useful for frontend configuration
and integration testing.

**Auth:** None

**Response 200:**

```json
{
  "tiers": [
    {
      "name":        "SURGICAL",
      "condition":   "result_count < 5",
      "http_status": 200,
      "payload":     "Fully decrypted — clean plaintext.",
      "risk":        "LOW"
    },
    {
      "name":        "ELEVATED",
      "condition":   "5 <= result_count <= 10",
      "http_status": 200,
      "payload":     "60% plaintext reveal + intent analysis metadata.",
      "risk":        "MEDIUM"
    },
    {
      "name":        "CRITICAL",
      "condition":   "result_count > 10",
      "http_status": 200,
      "payload":     "Structurally valid Fernet tokens encrypting garbage.",
      "risk":        "HIGH — Heisenberg countermeasure active"
    }
  ]
}
```

---

### GET /api/benchmark

Runs a live performance benchmark in-process. Executes 20 SURGICAL decryptions and 5
CRITICAL obfuscations, then returns timing statistics.

> **Note:** This endpoint performs real cryptographic work on every call. Do not call it
> from a high-frequency monitoring loop.

**Auth:** None

**Response 200:**

```json
{
  "surgical": {
    "n": 20,
    "avg_ms": 2.34,
    "min_ms": 1.10,
    "max_ms": 4.20
  },
  "critical": {
    "n": 5,
    "avg_ms": 8.71,
    "note": "Full Fernet mutation + garbage generation per sweep"
  },
  "overhead_claim": "Surgical immunity costs 2.3ms avg per query",
  "verdict": "PRODUCTION READY",
  "timestamp": "2026-05-31T10:25:00.000000+00:00"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `surgical.n` | `int` | Number of surgical decryptions run. Always `20`. |
| `surgical.avg_ms` | `float` | Average time per single-record decryption in ms. |
| `surgical.min_ms` | `float` | Fastest surgical decryption in this run. |
| `surgical.max_ms` | `float` | Slowest surgical decryption in this run. |
| `critical.n` | `int` | Number of 15-record CRITICAL sweeps run. Always `5`. |
| `critical.avg_ms` | `float` | Average time per 15-record obfuscation sweep in ms. |
| `overhead_claim` | `string` | Human-readable summary sentence. |
| `verdict` | `"PRODUCTION READY"` | Static string. |

---

### POST /api/demo/run

Triggers the 3-act automated attack simulation as a background task. Each act broadcasts a
WebSocket `AUDIT_EVENT` to all connected clients so the dashboard updates live.

**Auth:** None

**Request body:** None

**Response 200 (immediate — acts run in background):**

```json
{
  "status": "demo_started",
  "acts": 3,
  "duration_seconds": 5
}
```

**Demo timeline:**

| Time | Act | Tier | Records | Behaviour |
|------|-----|------|---------|-----------|
| `t = 0s` | 1 | SURGICAL | 1 | Single patient lookup — clean decrypt |
| `t = 2.5s` | 2 | ELEVATED | 7 | SOC analysis — classified as SURGICAL, 60% reveal |
| `t = 5s` | 3 | CRITICAL | 30 | Full Heisenberg mutation — garbage payloads |

Each act emits a WebSocket `AUDIT_EVENT` with `tier`, `record_count`, `soc_narrative`, and
`is_mutation`. Connect to [`/ws/events`](#websocket-wsevents) before calling this endpoint
to observe all three acts live.

---

### WebSocket /ws/events

Real-time audit event stream. The dashboard connects here on page load. Every query that
passes through `/api/query` — and every demo act — emits a message to all connected clients.

**Protocol:** WebSocket (`ws://` or `wss://`)

**URL:**
- Local: `ws://localhost:8000/ws/events`
- Production: `wss://heisenberg-vault-backend.onrender.com/ws/events`

**Auth:** None

**Keep-alive:** Send any text frame to keep the connection alive. The server reads and
discards text frames; disconnecting on `WebSocketDisconnect` is handled gracefully.

**Inbound message format:**

```json
{
  "type": "AUDIT_EVENT",
  "tier": "CRITICAL",
  "record_count": 30,
  "timestamp": "2026-05-31T10:24:15.789012+00:00",
  "caller_ip": "203.0.113.42",
  "soc_classification": "MASS_SURVEILLANCE",
  "soc_narrative": "Heuristic: query sweeps 60% of the vault — consistent with bulk data harvesting.",
  "is_mutation": true
}
```

**WebSocket event field reference:**

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"AUDIT_EVENT"` | Always `AUDIT_EVENT`. Reserved for future event types. |
| `tier` | `string` | `SURGICAL`, `ELEVATED`, or `CRITICAL`. |
| `record_count` | `int` | Number of records in the triggering query. |
| `timestamp` | `string` | ISO 8601 UTC of the server-side event. |
| `caller_ip` | `string` | Source IP of the caller, or `"demo-runner"` for demo acts. |
| `soc_classification` | `string \| null` | `"SURGICAL"`, `"MASS_SURVEILLANCE"`, or `null`. |
| `soc_narrative` | `string \| null` | LLM or heuristic explanation, or system note. |
| `is_mutation` | `bool` | `true` when tier is `CRITICAL`. Signals the dashboard to show the mutation overlay. |

**Example (JavaScript):**

```javascript
const ws = new WebSocket('wss://heisenberg-vault-backend.onrender.com/ws/events');

ws.onopen = () => console.log('[Vault] WebSocket connected');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'AUDIT_EVENT' && data.is_mutation) {
    console.warn('[Vault] CRITICAL mutation detected from', data.caller_ip);
  }
};

ws.onclose = () => console.log('[Vault] WebSocket disconnected');

// Keep-alive ping every 30 seconds
setInterval(() => ws.readyState === WebSocket.OPEN && ws.send('ping'), 30000);
```

---

## Error Reference

| Status | Condition | Body |
|--------|-----------|------|
| `200` | All vault query responses (all tiers) | See [Response Envelope](#response-envelope) |
| `200` | Database error in `/api/health` | `database: "error"`, `records: -1` |
| `400` | Blocked SQL keyword in `sql` parameter | `{"detail": "Query contains blocked keywords..."}` |
| `400` | SQL does not reference `sensitive_records` | `{"detail": "Query must reference the sensitive_records table."}` |
| `400` | SQL syntax error | `{"detail": "SQL error: <sqlite3 error message>"}` |
| `401` | Invalid login credentials | `{"detail": "Invalid credentials"}` |
| `401` | Expired JWT on protected endpoint | `{"detail": "Token expired"}` |
| `401` | Invalid/malformed JWT | `{"detail": "Invalid token"}` |
| `422` | FastAPI request validation error (e.g., `limit` out of range) | FastAPI default validation error body |

> All tier responses — including CRITICAL sweeps — always return `200`. A `4xx` from
> `/api/query` means the request itself was malformed, not that surveillance was detected.

---

## cURL Cheat Sheet

```bash
BASE="http://localhost:8000"

# 1. Get a JWT token
TOKEN=$(curl -s -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"vault_admin","password":"heisenberg2026"}' \
  | python -m json.tool | grep '"token"' | cut -d'"' -f4)

# 2. SURGICAL query (2 records)
curl -s "$BASE/api/query?limit=2" | python -m json.tool

# 3. SURGICAL query — single record by ID
curl -s "$BASE/api/query?id=1" | python -m json.tool

# 4. ELEVATED query (7 records — LLM SOC analysis fires)
curl -s "$BASE/api/query?limit=7" | python -m json.tool

# 5. CRITICAL query (20 records — garbage payloads returned)
curl -s "$BASE/api/query?limit=20" | python -m json.tool

# 6. Raw SQL — SURGICAL
curl -s "$BASE/api/query?sql=SELECT+*+FROM+sensitive_records+WHERE+id=1" \
  | python -m json.tool

# 7. Raw SQL — CRITICAL sweep
curl -s "$BASE/api/query?sql=SELECT+*+FROM+sensitive_records+LIMIT+50" \
  | python -m json.tool

# 8. Audit log (JWT required)
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/audit" \
  | python -m json.tool

# 9. Verify hash chain (JWT required)
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/audit/verify" \
  | python -m json.tool

# 10. Status
curl -s "$BASE/api/status" | python -m json.tool

# 11. Health
curl -s "$BASE/api/health" | python -m json.tool

# 12. Tier reference
curl -s "$BASE/api/tiers" | python -m json.tool

# 13. Live benchmark
curl -s "$BASE/api/benchmark" | python -m json.tool

# 14. Trigger 3-act demo
curl -s -X POST "$BASE/api/demo/run" | python -m json.tool
```

---

## Tier Classification Logic

### Primary classification (by result count)

```
classify_tier(result_count):
  if result_count < 5:   return SURGICAL
  if result_count <= 10: return ELEVATED
  return CRITICAL
```

### AI escalation (ELEVATED tier only)

When the primary tier is `ELEVATED`, the SOC Analyst runs asynchronously:

1. Build a query description: `SQL: <sql> | records_returned=<n> | record_ids=[...] | caller_ip=<ip>`
2. Call the active LLM backend with the prompt sandboxed inside `<<< >>>` delimiters
3. Parse the JSON response: `{"classification": "SURGICAL"|"MASS_SURVEILLANCE", "confidence": float, "narrative": "..."}`
4. If `classification == "MASS_SURVEILLANCE"`: escalate to CRITICAL
5. If LLM fails or returns null: fall through to heuristic

### Heuristic fallback

```
sweep_ratio = len(requested_ids) / max(len(all_vault_ids), 1)

if sweep_ratio >= 0.30: MASS_SURVEILLANCE
else:                   SURGICAL
```

### Temporal escalation (all tiers)

```
RateTracker window: 60 seconds, per IP
Triggers when:  query_count >= 5  OR  total_records >= 15

On trigger: escalate to CRITICAL, prefix query_str with "[PATTERN]" in audit log
```

### LLM backends

Backends are tried in this priority order. First match (env var set and non-empty) wins:

| Priority | Backend | Env var | Model | Notes |
|----------|---------|---------|-------|-------|
| 1 | Ollama (local) | `OLLAMA_MODEL` | Any | Requires local Ollama server |
| 2 | LM Studio (local) | `LM_STUDIO_MODEL` | Any | Requires local LM Studio server |
| 3 | Kimi | `KIMI_API_KEY` | `moonshot-v1-8k` | Free credits on signup |
| 4 | Groq | `GROQ_API_KEY` | `llama-3.3-70b-versatile` | Free tier, recommended |
| 5 | OpenRouter | `OPENROUTER_API_KEY` | `qwen/qwq-32b:free` | Free tier |
| 6 | OpenAI | `OPENAI_API_KEY` | `gpt-4o-mini` | Paid |
| 7 | Heuristic | — | — | Always available, no network required |

---

*Heisenberg Vault API Reference — v1.0.0*
*Built by Pentogram Team for Codorra 2026 — Unstop Hackathon*
