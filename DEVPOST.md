TITLE: Heisenberg Vault — Observation Destroys the Data

TAGLINE: The first database privacy layer that makes mass surveillance mathematically impossible.

COVER IMAGE NOTE: Screenshot the dashboard in CRITICAL state — red mutation banner active, hex garbage in PayloadPane, ThreatGraph showing red spike.

---

INSPIRATION:
In 2023, a single bulk SQL query exposed 6.9 million 23andMe users. The database returned every record cleanly. The attacker received a successful HTTP 200. Standard firewalls returned 403 errors — which told the attacker exactly where the data was.

We asked: what if the database itself fought back — silently, invisibly, and mathematically?

---

WHAT IT DOES:
Heisenberg Vault is a zero-trust middleware layer you drop in front of any SQL database. It routes every query through a 3-tier security engine:

• SURGICAL (<5 records): Clean decryption. Legitimate access is unaffected.
• ELEVATED (5–10 records): An AI SOC Analyst (powered by Groq/OpenAI/Ollama) classifies the intent. Suspicious queries are silently escalated.
• CRITICAL (>10 records OR AI-detected mass surveillance): The Vault activates the Heisenberg Countermeasure. It generates ephemeral salt-derived Fernet keys, encrypts garbage payloads, and returns HTTP 200 — "Bulk export completed successfully." The attacker leaves with 50,000 records and zero usable data.

The attacker is never told they've been detected. That's the point.

---

HOW WE BUILT IT:
Backend: FastAPI + Python (cryptography, PyJWT, openai SDK)
Crypto: Fernet AES-128-CBC with dual-HMAC ephemeral key derivation
AI Layer: 7-backend LLM fallback chain (Groq → Kimi → OpenRouter → OpenAI → Ollama → LM Studio → heuristic)
Audit: Tamper-evident blockchain-style SHA-256 hash chain
Frontend: React + Vite + Tailwind CSS
Real-time: WebSocket push for live mutation alerts
Infrastructure: Docker + Render (backend) + Vercel (frontend)

---

CHALLENGES:
- Timing side-channel: a fast SURGICAL response vs slow CRITICAL response would reveal detection. We pad all responses to 150ms minimum with random jitter.
- LLM reliability: any single LLM can fail or rate-limit. We built a 7-backend fallback chain so the ELEVATED tier always resolves.
- The deception must be complete: the garbage payloads must be structurally valid Fernet tokens (not random bytes) or a smart attacker would detect them by format. Two-layer fake-plaintext-then-encrypt solves this.

---

ACCOMPLISHMENTS:
- Live public deployment accessible from any browser
- 3-tier routing with AI intent analysis fully functional
- Tamper-evident audit log with cryptographic chain verification
- Real-time WebSocket push for live mutation alerts
- One-click 3-act demo runner for judges
- Sub-3ms surgical query overhead (benchmarked live at /api/benchmark)

---

WHAT WE LEARNED:
Deception as a security primitive is underexplored. Most security tools shout when they detect an attack. The most powerful response is silence — return success, return garbage, and let the attacker waste their time.

---

WHAT'S NEXT:
- pip-installable package: from heisenberg_vault import Vault
- PostgreSQL and MongoDB adapters
- Enterprise dashboard with team-based access control
- Formal security audit of the ephemeral key derivation

---

LIVE DEMO: https://heisenberg-vault-frontend.vercel.app
GITHUB: https://github.com/Pentogram-team/corodora-hackathon-by-unstop
VIDEO: [30-second screen recording of the 3-act demo]
