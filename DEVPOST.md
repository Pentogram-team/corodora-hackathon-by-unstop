TITLE: Heisenberg Vault — Observation Destroys the Data

TAGLINE: The first database privacy layer that makes mass surveillance mathematically impossible.

COVER IMAGE NOTE: Screenshot the dashboard in CRITICAL state — red mutation banner active, cryptographic garbage tokens in PayloadPane, ThreatGraph showing a red spike. Toggle ATTACKER VIEW on so judges see exactly what the adversary receives.

================================================================================

INSPIRATION

In 2023, a single bulk SQL query exposed 6.9 million 23andMe users. One attacker, one command:

    SELECT * FROM users

The database returned every record cleanly. HTTP 200. The attacker said thank you.

Standard security tools returned 403 errors — which told the attacker exactly where the data lived and that they had been detected. Rate limiters returned 429 — which confirmed there was something worth stealing and that their rate was too high. Every defensive signal was a free intelligence report.

We asked a different question: what if the database fought back silently? What if it said yes — and meant no?

The Heisenberg uncertainty principle states that observing a quantum system at scale disturbs the system itself. The act of measurement changes the thing being measured. We applied this principle to database security: observation at scale should mathematically corrupt the observed data. The attacker receives a complete, successful response — with data that can never be used.

Heisenberg Vault does not block. It does not rate-limit. It does not return 403. It cooperates perfectly — and the data it returns is worthless.

================================================================================

WHAT IT DOES

Heisenberg Vault is a zero-trust middleware layer that sits in front of any SQL database. Every incoming query is routed through a 3-tier security engine based on observation scope:

SURGICAL (fewer than 5 records)
Legitimate clinical or targeted access. The system performs full Fernet AES-128-CBC decryption and returns real plaintext data. Zero friction for authorised users. A nurse checking 1-4 patient records never knows the Vault exists.

ELEVATED (5 to 10 records)
The ambiguous zone. An embedded AI SOC Analyst — powered by Groq LLaMA 3.3 70B, with 6 fallback backends — classifies the query intent in real time. The prompt is sandboxed against injection with delimiter guards. If the model classifies the query as MASS_SURVEILLANCE, the request is silently escalated to CRITICAL without any visible change in the response shape. If it classifies it as SURGICAL, the caller receives a 60% partial reveal with the lower portion redacted.

CRITICAL (more than 10 records, or AI-escalated from ELEVATED)
The Heisenberg Countermeasure activates. The system derives an ephemeral Fernet key per record using dual-HMAC key stretching — HMAC(HMAC(SESSION_ENTROPY, nonce + record_id), "heisenberg-mutation") — then encrypts realistic fake plaintext (medical-record-shaped fields) with this key. The response is HTTP 200, status "ok", clearance "FULL", note "Bulk payload export completed successfully." The attacker receives structurally valid Fernet tokens that will never decrypt under any honest key. They leave thinking they won.

The attacker is never told they have been detected. That is the entire point.

Every single tier — SURGICAL, ELEVATED, and CRITICAL — returns the identical outer JSON shape and HTTP 200. There is no tell. There is no perimeter to probe.

================================================================================

HOW WE BUILT IT

Backend: FastAPI (Python 3.11) with async throughout. All I/O — LLM calls, database queries, WebSocket broadcasts, SOC webhook alerts — is non-blocking so mutation overhead never delays the response.

Cryptography: cryptography library (Fernet/AES-128-CBC) for real data at rest. hmac and hashlib for dual-HMAC ephemeral key derivation in the CRITICAL tier. The garbage tokens are not random bytes — they are structurally valid Fernet ciphertext that passes format validation and length checks.

AI Layer: A single openai SDK instance with a swappable base_url drives all 7 backends. Priority order: Ollama (local, no API key) → LM Studio (local) → Kimi → Groq → OpenRouter → OpenAI → mathematical sweep-ratio heuristic. The heuristic requires zero external dependencies and ensures 100% uptime.

Audit: Every access — SURGICAL, ELEVATED, CRITICAL — is recorded in a tamper-evident SHA-256 hash chain. Each row stores its own hash and the previous row's hash (blockchain-style). Deleting or modifying any row breaks all subsequent hashes. The VERIFY CHAIN button in the dashboard calls /api/audit/verify and traverses the full chain live.

Authentication: PyJWT HS256 tokens with 1-hour expiry protect all admin endpoints (/api/audit, /api/audit/verify). The query endpoint (/api/query) is intentionally public — attackers must be able to reach it for the deception to function.

Real-time: FastAPI native WebSockets on /ws/events. Every tier decision is broadcast to all connected dashboard clients. CRITICAL mutations light up the entire interface in real time without a page refresh.

SOC Alerting: When a CRITICAL event fires, an async httpx POST is sent to a configurable Discord/Slack webhook — a simulated PagerDuty alert with tier, caller IP, and the LLM's narrative. The alert is fire-and-forget so it never adds latency to the attacker-facing response.

Temporal Attack Detection: A sliding 60-second window RateTracker catches attackers who stay under per-query thresholds by spreading requests over time. If an IP accumulates more than 5 queries or more than 15 total records inside 60 seconds, the next request is automatically escalated to CRITICAL regardless of count.

Frontend: React 18 + Vite + Tailwind CSS. Components: ThreatGraph (SVG time-series showing tier distribution across the session), AuditLog (SESSION and PERSISTENT tabs with live WebSocket updates), PayloadPane (ADMIN VIEW shows real data; ATTACKER VIEW shows exactly what the adversary receives), QueryBuilder (PRESET queries, free-form SQL, and GUEST MODE for demo-day attendees without admin credentials), LoginScreen (JWT auth form), Header (LIVE WebSocket badge, benchmark button, demo runner).

Infrastructure: Docker + docker-compose for one-command local setup. Render.com for backend (render.yaml, zero-touch, auto-provisioned VAULT_MASTER_KEY). Vercel for frontend (vercel.json, Vite framework, auto-detected).

================================================================================

CHALLENGES WE RAN INTO

Timing side-channel

A SURGICAL response completes in approximately 2ms — one database query, one Fernet decrypt. A CRITICAL response for 30 records — generating 30 unique ephemeral keys and 30 fake plaintext payloads — completes in approximately 10ms. An attacker measuring Time-To-First-Byte across multiple requests could infer which tier fired and therefore confirm that surveillance was detected.

Solution: pad every response to a minimum of 150ms with random jitter between 10ms and 50ms. All tiers are now timing-indistinguishable within normal network variance. This is not premature optimisation — it is a required security control.

Garbage must be convincing under format inspection

Random bytes would fail Fernet format validation immediately. A smart attacker would detect the garbage in under a second by checking whether the ciphertext begins with the Fernet version byte (0x80) and passes base64url decoding. The deception would collapse.

Solution: use a two-layer approach. First, construct realistic fake plaintext with medical-record-shaped fields — vault identifiers, mutation epoch timestamps, checksums. Then encrypt that fake plaintext with the ephemeral key. The output is a structurally perfect Fernet token that passes every format check. The attacker cannot distinguish it from a real token without the ephemeral key, which they cannot derive without SESSION_ENTROPY, which regenerates on every server restart.

LLM reliability during live demos

Any single LLM provider can fail, rate-limit, or return unparseable output mid-demo. A system that depends on one provider is a single point of failure the judges will discover at the worst possible moment.

Solution: 7-backend fallback chain with automatic cascade. The system tries each backend in priority order. If the LLM response is unparseable, it falls through to the next provider. The final fallback is a pure-math heuristic — if the sweep ratio (records requested divided by total vault size) exceeds 30%, classify as MASS_SURVEILLANCE. This requires zero network calls, zero API keys, and always produces a deterministic result.

================================================================================

ACCOMPLISHMENTS WE'RE PROUD OF

Live public deployment accessible from any browser — not a localhost demo, not a video. Judges can attack it right now from the submission page.

Three-tier routing with AI intent analysis fully functional end-to-end, including the ELEVATED-to-CRITICAL escalation path triggered by LLM classification.

Tamper-evident audit log with cryptographic chain verification. The VERIFY CHAIN button in the dashboard calls the live API and reports the integrity status of every entry ever written.

Real-time WebSocket push — CRITICAL mutations appear live on every connected dashboard without a page refresh. The LIVE badge goes green on connection and red on disconnect.

Sub-3ms surgical query overhead, benchmarked live at /api/benchmark. The system adds no perceptible latency for legitimate clinical queries.

ATTACKER VIEW toggle in PayloadPane — judges can switch between what the admin sees (real decrypted data) and what the attacker sees (HTTP 200, clearance FULL, a complete Fernet-tokenised dataset that will never decrypt). The deception is visible and visceral.

One-click 3-act demo runner at /api/demo/run — launches SURGICAL at t=0, ELEVATED at t=2.5s, CRITICAL at t=5s automatically, with live WebSocket events narrating each act on the dashboard.

================================================================================

WHAT WE LEARNED

Deception is an underexplored security primitive.

The entire security industry is built on detection and blocking — tools that announce when they have caught an attacker. A 403 is a confession. A 429 is a map. Every defensive signal tells the attacker something. Heisenberg Vault inverts this completely: the most powerful response is silence. Return success. Return garbage. Let the attacker waste their exfiltration pipeline, their processing budget, and their operational window on data that is mathematically worthless.

We also learned that timing is a security property, not just a performance metric. A consistent 2ms vs 10ms response time differential is exploitable by any attacker with a stopwatch and a script. The 150ms padding is not an afterthought — it is load-bearing security infrastructure. Remove it and the entire tier system becomes a timing oracle.

Finally: the 7-provider LLM fallback chain taught us that graceful multi-backend degradation is a first-class engineering concern, not an afterthought. Real AI-powered security tools must assume that any given provider will fail at the worst possible time and design accordingly from day one.

================================================================================

WHAT'S NEXT

pip-installable middleware package: pip install heisenberg-vault, then from heisenberg_vault import Vault as a drop-in decorator for any Flask or FastAPI route.

PostgreSQL and MongoDB adapters via the VaultDB abstraction layer already scaffolded in database.py.

Rate-of-fire temporal attack detection is already implemented as RateTracker — the next step is making the window size and thresholds configurable via environment variables.

Enterprise dashboard with team-based access control, cross-organisation threat intelligence sharing, and SIEM webhook integration for Splunk and Elastic.

Formal security audit of the dual-HMAC ephemeral key derivation chain, including resistance analysis against known-plaintext and chosen-ciphertext attacks on the garbage tokens.

Hardware Security Module (HSM) integration to bind VAULT_MASTER_KEY to a physical device for FIPS 140-2 compliance.

================================================================================

BUILT WITH

Python 3.11, FastAPI, Uvicorn, cryptography (Fernet / AES-128-CBC), hmac, hashlib, PyJWT, openai SDK, httpx, React 18, Vite, Tailwind CSS, WebSockets, Docker, docker-compose, Render.com, Vercel, Groq (LLaMA 3.3 70B), SQLite, psycopg2-binary

================================================================================

LIVE DEMO:  https://heisenberg-vault-backend.onrender.com/docs
DASHBOARD:  https://heisenberg-vault.vercel.app
LOGIN:      vault_admin / heisenberg2026
GITHUB:     https://github.com/Pentogram-team/corodora-hackathon-by-unstop
VIDEO:      [30-second screen recording — CRITICAL sweep, ATTACKER VIEW toggle, hash chain verification]

================================================================================

HOW TO TEST IN 60 SECONDS

1. Open the dashboard. Log in with vault_admin / heisenberg2026.
2. Click RUN DEMO. Watch SURGICAL → ELEVATED → CRITICAL fire automatically.
3. In PayloadPane, toggle ATTACKER VIEW. See what the adversary received.
4. In AuditLog, click VERIFY CHAIN. Confirm the hash chain is intact.
5. Open /api/benchmark to see sub-3ms surgical overhead live.
6. Open /docs and call GET /api/query?limit=20 directly. HTTP 200. Clearance FULL. The tokens will not decrypt.

================================================================================

Built by Pentogram Team for Codorra 2026 — Unstop Hackathon.
