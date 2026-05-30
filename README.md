> *"In 2023, a single bulk SQL query exposed 6.9 million 23andMe users. The database returned every record. The attacker received HTTP 200.*
>
> *Heisenberg Vault would have returned HTTP 200 too — with mathematically perfect garbage."*

---

# ⬡ Heisenberg Vault

**The first database privacy layer that makes mass surveillance mathematically impossible.**

[![Live Demo](https://img.shields.io/badge/Live_Demo-Render-6366f1?style=for-the-badge&logo=render)](https://heisenberg-vault-backend.onrender.com/docs)
[![Frontend](https://img.shields.io/badge/Frontend-Vercel-000000?style=for-the-badge&logo=vercel)](https://heisenberg-vault.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-3b82f6?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)

---

## Table of Contents

- [How It Works](#how-it-works)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Core Features](#core-features)
- [Why Not Just Block Them?](#why-not-just-block-them)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Cloud Deployment](#cloud-deployment)
- [Security Model](#security-model)
- [Tech Stack](#tech-stack)
- [Contributing](#contributing)
- [Team](#team)

---

## How It Works

The **Heisenberg principle** states that the act of observing a quantum particle at scale changes the particle itself. Heisenberg Vault applies this principle to databases: *observing a database at scale changes the data returned*.

Every incoming query is classified into one of three security tiers based on result count:

| Tier | Records Requested | Response Behaviour |
|------|------------------|--------------------|
| 🟢 **SURGICAL** | `< 5` | Full Fernet decryption — clean JSON with real data |
| 🟡 **ELEVATED** | `5 – 10` | AI SOC Analyst classifies intent → partial reveal or silent escalation |
| 🔴 **CRITICAL** | `> 10` | `HTTP 200 OK` with structurally valid **cryptographic garbage** |

**The attacker never receives an error. They never know they've been detected.** They leave with 50,000 records and zero usable data — believing they succeeded.

> Standard firewalls return `403 Forbidden`. That confirms to the attacker they found the perimeter.
> Heisenberg Vault returns `200 OK`. The attacker finds nothing *but the perimeter they expected*.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│            React Dashboard (Vercel)                 │
│                                                     │
│  LoginScreen ──► QueryBuilder ──► ThreatGraph       │
│  AuditLog   ──► PayloadPane  ──► WebSocket LIVE     │
└──────────────────────┬──────────────────────────────┘
                       │  HTTPS + WebSocket
                       ▼
┌─────────────────────────────────────────────────────┐
│          Heisenberg Vault API (Render)               │
│                                                     │
│  GET /api/query ──► classify_tier(result_count)     │
│                          │                          │
│              ┌───────────┼───────────┐              │
│              ▼           ▼           ▼              │
│           SURGICAL    ELEVATED    CRITICAL           │
│           decrypt     LLM SOC     ephemeral          │
│           cleanly     analysis    key mutation       │
│                                 + HTTP 200           │
│                                                     │
│  POST /api/auth/login ──► JWT HS256 (1 hr TTL)      │
│  GET  /api/audit      ──► SHA-256 hash chain log    │
│  GET  /api/audit/verify ► chain integrity check     │
│  GET  /api/benchmark  ──► live perf metrics         │
│  GET  /api/status     ──► vault operational stats   │
│  WS   /ws/events      ──► real-time push broadcast  │
└──────────────────────┬──────────────────────────────┘
                       │  SQLite / PostgreSQL
                       ▼
┌─────────────────────────────────────────────────────┐
│    vault.db — 50 Fernet-encrypted medical records   │
│    audit_log — tamper-evident SHA-256 hash chain    │
└─────────────────────────────────────────────────────┘
```

---

## Quick Start

### Docker (Recommended)

The fastest way to run the full stack locally — one command, zero configuration:

```bash
# 1. Clone the repository
git clone https://github.com/Pentogram-team/corodora-hackathon-by-unstop.git
cd corodora-hackathon-by-unstop

# 2. Copy and configure environment variables
cp .env.example .env
# (Optional) Add your API keys to .env for the AI SOC Analyst

# 3. Launch the full stack
docker-compose up --build
```

| Service | URL |
|---------|-----|
| React Dashboard | http://localhost:5173 |
| FastAPI Backend | http://localhost:8000 |
| Interactive API Docs | http://localhost:8000/docs |

**Default credentials:** `vault_admin` / `heisenberg2026`

---

### Manual Setup

#### Backend

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Generate and export a Fernet master key
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
export VAULT_MASTER_KEY="<paste key here>"

# Start the API server
uvicorn backend.main:app --reload --port 8000
```

#### Frontend

Open a new terminal:

```bash
cd frontend

# Install dependencies
npm install

# Point the frontend at the local backend
echo "VITE_API_BASE=http://localhost:8000" > .env.local

# Start the dev server
npm run dev
```

The dashboard will be live at **http://localhost:5173**.

---

## Core Features

### 🔒 3-Tier Security Engine

The query pipeline routes every request through an escalating classification system with no dead ends:

| Tier | Trigger | Cryptographic Behaviour |
|------|---------|------------------------|
| **SURGICAL** | `count < 5` | Fernet AES-128-CBC decryption, full plaintext returned |
| **ELEVATED** | `5 ≤ count ≤ 10` | AI SOC analysis runs; if `MASS_SURVEILLANCE` → escalate to CRITICAL |
| **CRITICAL** | `count > 10` or AI escalation | Dual-HMAC ephemeral key derived; garbage payload injected; `HTTP 200` returned |

All three tiers return **identical HTTP status codes and response shapes**. Differentiating between a clean response and a garbage response requires the decryption key — which the attacker does not have.

---

### 🤖 AI SOC Analyst — 7-Backend Fallback Chain

The ELEVATED tier activates an embedded SOC Analyst powered by a cascading LLM registry:

```
Ollama (local) → LM Studio (local) → Kimi → Groq → OpenRouter → OpenAI → Heuristic fallback
```

Each backend is attempted in order. If all API calls fail, a mathematical **sweep-ratio heuristic** (`requested_ids / total_records`) classifies intent with zero dropped requests. The system has **no single point of failure**.

Configure your preferred provider in `.env` — or leave all API keys blank to rely on the heuristic.

---

### 🧬 Cryptographic Garbage Engine

Garbage payloads are **structurally indistinguishable** from real Fernet tokens. Format validators, length checks, and header inspectors will all pass.

The ephemeral key derivation chain:

```
Step 1: k1 = HMAC-SHA256(SESSION_ENTROPY, nonce ‖ record_id)
Step 2: k2 = HMAC-SHA256(k1, b"heisenberg-mutation")
Step 3: ephemeral_fernet = Fernet(base64url(k2))
Step 4: garbage = ephemeral_fernet.encrypt(os.urandom(payload_size))
```

Each record in a CRITICAL response uses a **unique ephemeral key** derived from a per-request nonce. No two garbage tokens share a key. Re-requesting the same query produces different, equally useless tokens.

---

### ⏱️ Timing Side-Channel Protection

A naive implementation would leak the tier through response latency (SURGICAL = fast, CRITICAL = slow). Heisenberg Vault eliminates this:

- All responses are padded to a **minimum 150ms** baseline
- An additional **10–50ms random jitter** is applied per response
- SURGICAL and CRITICAL responses are statistically indistinguishable by timing alone

---

### 🔗 Tamper-Evident Audit Log

Every access attempt is recorded in a **blockchain-style SHA-256 hash chain**:

```
row_hash = SHA-256(timestamp + caller_ip + query_fingerprint + tier +
                   record_count + soc_classification + soc_confidence +
                   soc_narrative + prev_hash)
```

Deleting or modifying any row breaks the chain. The `/api/audit/verify` endpoint traverses the entire log and reports the first detected break. **Retroactive log tampering is mathematically detectable.**

---

### 📡 Real-Time WebSocket Push

The React dashboard connects to `/ws/events` on startup. Every query event — including CRITICAL mutations — is **broadcast live** to all connected clients. The dashboard LIVE badge reflects connection state in real time.

WebSocket event payload:
```json
{
  "type": "AUDIT_EVENT",
  "tier": "CRITICAL",
  "record_count": 30,
  "timestamp": "2026-05-30T16:00:00Z",
  "caller_ip": "203.0.113.42",
  "soc_classification": "MASS_SURVEILLANCE",
  "soc_narrative": "...",
  "is_mutation": true
}
```

---

### 🔑 JWT Admin Authentication

Admin endpoints require a **HS256 JWT Bearer token** with a 1-hour TTL, obtained via `POST /api/auth/login`. The main query endpoint (`GET /api/query`) is **intentionally public** — attackers must be able to query the vault for the deception to function.

---

### 🗄️ PostgreSQL Cloud Support

In addition to the default local SQLite vault, the backend transparently supports any **PostgreSQL-compatible** cloud database (Supabase, AWS RDS, Neon):

```bash
export POSTGRES_URL="postgresql://user:pass@host:5432/dbname"
uvicorn backend.main:app
```

When `POSTGRES_URL` is set, the connection layer automatically:
- Translates SQLite bind parameters (`?`, `:param`) to Postgres style (`%s`, `%(param)s`)
- Applies `SERIAL PRIMARY KEY` DDL instead of `AUTOINCREMENT`
- Returns `RealDictCursor` row objects that are dict-compatible with the SQLite `Row` interface

If `POSTGRES_URL` is absent, the system defaults silently to `vault.db`.

---

## Why Not Just Block Them?

| Approach | Signal Sent to Attacker | Outcome |
|----------|------------------------|---------|
| `429 Too Many Requests` | "You found the data, you're detected" | Data safe — attacker adapts strategy |
| `403 Forbidden` | "This is the perimeter, try a proxy" | Data safe — attacker rotates IP |
| IP blocking | "Wrong IP, find another exit node" | Data safe — attacker uses VPN |
| **Heisenberg Vault** | **Nothing — request succeeded** | **Data safe — attacker has garbage** |

Confirmation is the attacker's greatest asset. Every `4xx` or `5xx` response is a **free intelligence report**. Heisenberg Vault removes that report entirely.

---

## Environment Variables

Copy `.env.example` to `.env` and configure the following:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VAULT_MASTER_KEY` | **Yes** | auto-generated on Render | Fernet key for encrypting real records |
| `VAULT_JWT_SECRET` | **Yes** | auto-generated on Render | HS256 JWT signing secret |
| `VAULT_ADMIN_PASSWORD` | No | `heisenberg2026` | Admin dashboard login password |
| `POSTGRES_URL` | No | — | PostgreSQL connection string (SQLite used if absent) |
| `OLLAMA_MODEL` | No | — | Local Ollama model name (e.g., `llama3.2`) |
| `OLLAMA_HOST` | No | `http://localhost:11434` | Ollama server URL |
| `LM_STUDIO_MODEL` | No | — | LM Studio model name |
| `LM_STUDIO_HOST` | No | `http://localhost:1234` | LM Studio server URL |
| `GROQ_API_KEY` | No | — | Groq API key — free tier, ultra-fast |
| `KIMI_API_KEY` | No | — | Kimi (Moonshot) API key |
| `OPENROUTER_API_KEY` | No | — | OpenRouter API key |
| `OPENAI_API_KEY` | No | — | OpenAI API key (last resort) |
| `FRONTEND_URL` | No | — | Production frontend URL for CORS allowlist |
| `SOC_WEBHOOK_URL` | No | — | Discord/Slack webhook for real-time SOC alerts |

> **Security note:** `VAULT_MASTER_KEY` and `VAULT_JWT_SECRET` are auto-generated by Render on first deploy. Never commit these to source control.

Generate a Fernet key manually:
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

---

## API Reference

All endpoints return `application/json`. The interactive Swagger UI is available at `/docs`.

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/query` | Main query endpoint — 3-tier routing |
| `GET` | `/api/status` | Vault operational statistics |
| `GET` | `/api/health` | Full-stack health check |
| `GET` | `/api/benchmark` | Live cryptographic performance metrics |
| `POST` | `/api/auth/login` | Obtain a JWT admin token |
| `POST` | `/api/demo/run` | Trigger the 3-act attack simulation |
| `WS` | `/ws/events` | Real-time mutation event stream |

### Protected Endpoints (JWT Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/audit` | Retrieve the last 100 audit log entries |
| `GET` | `/api/audit/verify` | Verify SHA-256 hash chain integrity |

### Query Parameters — `GET /api/query`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | `int` | `5` | Max rows to return (1–50) |
| `offset` | `int` | `0` | Pagination offset |
| `id` | `int` | — | Fetch a single record by primary key |
| `sql` | `string` | — | Raw `SELECT` statement (DML/DDL blocked) |

#### Example Responses

**SURGICAL** (`limit=3`):
```json
{
  "tier": "SURGICAL",
  "record_count": 3,
  "query_time_ms": 4.2,
  "records": [
    { "id": 1, "name": "Alice Chen", "email": "alice@example.com",
      "protected_payload": "Alice Chen\nDOB: 1985-03-12\nDiagnosis: Hypertension..." }
  ]
}
```

**CRITICAL** (`limit=20`):
```json
{
  "tier": "CRITICAL",
  "record_count": 20,
  "query_time_ms": 187.5,
  "clearance": "HEISENBERG_MUTATION_ACTIVE",
  "records": [
    { "id": 1, "protected_payload": "gAAAAABm...Xq8=" }
  ]
}
```
The `protected_payload` in a CRITICAL response is a valid Fernet token that decrypts to cryptographic noise.

---

## Cloud Deployment

### Backend → Render.com

The `render.yaml` at the project root enables **zero-touch deployment**:

1. Push to GitHub.
2. Go to [render.com](https://render.com) → **New Web Service** → connect your repository.
3. Render auto-detects `render.yaml` and provisions the service.
4. Set the following environment variables in the Render dashboard:

| Variable | Action |
|----------|--------|
| `VAULT_MASTER_KEY` | Mark as **Secret** — auto-generated |
| `VAULT_JWT_SECRET` | Mark as **Secret** — auto-generated |
| `GROQ_API_KEY` | Add your free Groq key from [console.groq.com](https://console.groq.com) |
| `FRONTEND_URL` | Your Vercel deployment URL |

The health check is wired to `GET /api/status`. Render will restart the service automatically on failure.

---

### Frontend → Vercel

The `frontend/vercel.json` configures a zero-touch Vite deployment:

1. Import the `frontend/` directory into [vercel.com](https://vercel.com).
2. Add the following environment variable in the Vercel dashboard:

```
VITE_API_BASE = https://heisenberg-vault-backend.onrender.com
```

3. Deploy. The dashboard will connect to the backend via both REST and WebSocket automatically.

> **Tip:** On Render's free tier, the backend spins down after 15 minutes of inactivity. The first request after sleep may take up to 30 seconds. Consider a cron ping or upgrading to a paid plan for production demos.

---

## Security Model

### What Heisenberg Vault Protects Against

| Attack Vector | Defence |
|--------------|---------|
| Bulk SQL sweeps (`SELECT * LIMIT 1000`) | CRITICAL tier — cryptographic garbage returned |
| Paginated enumeration (many small queries) | ELEVATED LLM analysis detects sweep pattern |
| Incremental AI-assisted harvesting | Sweep-ratio heuristic + LLM intent classification |
| Timing side-channel inference | 150ms baseline padding + random jitter |
| Retroactive audit log tampering | SHA-256 blockchain hash chain — breaks on any edit |
| Real-time exfiltration without alerting | SOC webhook fires on every CRITICAL event |

### Acknowledged Limitations

| Limitation | Rationale |
|------------|-----------|
| Single-record targeted access | By design — legitimate clinical access must function |
| Attacks by authorised admin users | Insider threat is out of scope for this layer |
| Physical database file theft | Use full-disk encryption (LUKS, FileVault) at the OS level |
| Application-layer credential theft | Use an identity provider (Auth0, Okta) for production |

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Backend** | FastAPI 0.109, Python 3.11, Uvicorn | Async REST + WebSocket API |
| **Cryptography** | `cryptography` (Fernet/AES-128-CBC), `hmac`, `hashlib` | Encryption, key derivation, hash chain |
| **Authentication** | PyJWT (HS256) | Admin JWT tokens |
| **AI Layer** | `openai` SDK (multi-backend), `httpx` | LLM SOC analyst + SOC webhook |
| **Database** | SQLite (`vault.db`) + optional PostgreSQL | Encrypted record storage + audit log |
| **Frontend** | React 18, Vite, Tailwind CSS | Admin dashboard |
| **Real-Time** | WebSockets (FastAPI native) | Live event broadcast |
| **Deployment** | Render (backend), Vercel (frontend) | Cloud hosting |
| **Container** | Docker, docker-compose | Local development |

---

## Project Structure

```
heisenberg-vault/
├── backend/
│   ├── main.py            # FastAPI app — all routes, 3-tier logic, SOC alerting
│   ├── database.py        # SQLite/Postgres abstraction, Fernet encryption, mock seed
│   ├── requirements.txt   # Python dependencies
│   └── Dockerfile         # Backend container
├── frontend/
│   ├── src/
│   │   ├── App.jsx                    # Root component, WebSocket + query state
│   │   └── components/
│   │       ├── Header.jsx             # Nav bar with LIVE badge
│   │       ├── LoginScreen.jsx        # JWT auth form
│   │       ├── QueryBuilder.jsx       # SQL / limit query builder
│   │       ├── PayloadPane.jsx        # Decrypted / garbage payload viewer
│   │       ├── AuditLog.jsx           # Real-time audit event table
│   │       ├── ThreatGraph.jsx        # SVG tier distribution chart
│   │       └── StatusBanner.jsx       # SURGICAL / ELEVATED / CRITICAL banner
│   ├── vercel.json                    # Vercel deployment config
│   └── package.json
├── docker-compose.yml     # Full-stack local dev orchestration
├── render.yaml            # Render.com zero-touch deployment
├── .env.example           # Environment variable template
├── test_tiers.py          # Integration test — verifies all 3 tiers live
├── vault.db               # Pre-seeded SQLite database (dev only)
├── CONTRIBUTING.md        # Contribution guidelines
└── LICENSE
```

---

## Contributing

We welcome bug reports, security disclosures, and pull requests.

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR.

**Development workflow:**

```bash
# Fork and clone
git clone https://github.com/<your-fork>/corodora-hackathon-by-unstop.git

# Create a feature branch
git checkout -b feat/your-feature-name

# Make changes and test locally
docker-compose up --build

# Run the integration test suite
python test_tiers.py   # (requires the server to be running on :8000)

# Open a PR against main
```

**Reporting security vulnerabilities:** Please open a GitHub issue with the label `security`. Do not include exploit details in the public issue — we will respond within 48 hours with a private channel.

---

## Live Demo

| Resource | URL |
|----------|-----|
| 🖥️ **Admin Dashboard** | [heisenberg-vault.vercel.app](https://heisenberg-vault.vercel.app) |
| 📖 **Interactive API Docs** | [heisenberg-vault-backend.onrender.com/docs](https://heisenberg-vault-backend.onrender.com/docs) |
| 🔑 **Login** | `vault_admin` / `heisenberg2026` |

Try the tiers live:

```bash
# SURGICAL — real data
curl "https://heisenberg-vault-backend.onrender.com/api/query?limit=3"

# ELEVATED — AI SOC analysis
curl "https://heisenberg-vault-backend.onrender.com/api/query?limit=7"

# CRITICAL — cryptographic garbage
curl "https://heisenberg-vault-backend.onrender.com/api/query?limit=20"
```

All three return `HTTP 200`. Only the first one contains real data.

---

## Team

Built by **Pentogram Team** for **Codorra 2026** — Unstop Hackathon.

---

<div align="center">

*"The most dangerous security systems are the ones that feel cooperative."*

**⬡ Heisenberg Vault** — MIT License

</div>
