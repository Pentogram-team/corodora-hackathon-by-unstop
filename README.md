> *"In 2023, a single bulk SQL query exposed 6.9 million 23andMe users. The database returned every record. A standard firewall returned a 403. The attacker knew exactly where the data was.*
>
> *Heisenberg Vault would have returned HTTP 200 — with mathematically perfect garbage."*

---

# Heisenberg Vault: Observation Destroys the Data

![Heisenberg Vault](https://img.shields.io/badge/Security-Zero%20Trust-red.svg?style=for-the-badge) ![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?style=for-the-badge) ![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB.svg?style=for-the-badge) ![WebSocket](https://img.shields.io/badge/Realtime-WebSocket-8B5CF6.svg?style=for-the-badge) ![License](https://img.shields.io/badge/License-MIT-slate.svg?style=for-the-badge)

## The Threat

Standard security scanners are purely reactive—they only tell you *after* you've been breached. Traditional firewalls and rate-limiters are loud; dropping a connection or returning a `403 Forbidden` error explicitly confirms to an attacker that they have found the perimeter of a high-value target. In modern cyber warfare, signaling your defensive posture is a fatal flaw.

## Why Not Just Rate-Limit?

Rate limiting tells the attacker three things: **(1)** you have data worth protecting, **(2)** you know they're looking, **(3)** where your perimeter is.

Heisenberg Vault tells the attacker **nothing** — it returns a successful response with structurally valid Fernet tokens that decrypt to cryptographic noise. The attacker leaves with 50,000 records and zero usable data.

## The Solution

Welcome to the **Heisenberg Vault**.

Built on the quantum principle that the mere act of observation alters the state of a system, the Vault intercepts mass surveillance and bulk data harvesting attempts in real-time. Instead of blocking the attacker, the Vault dynamically mutates its internal Fernet cryptographic keys.

It returns a pristine `HTTP 200 OK`, feeding the attacker mathematically perfect, structurally sound cryptographic garbage payloads. The attacker is completely blinded, yet they believe they have successfully exfiltrated the database.

## The 3-Tier Architecture

The Vault routes incoming database queries through a dynamically escalating security tier system:

1. **SURGICAL (Clean JSON)**: For highly specific queries (e.g., `< 5 records`), the Vault assumes legitimate clinical access. It cleanly decrypts the payloads and returns the real data instantly.
2. **ELEVATED (AI Intent Analysis)**: For moderate queries (`5 - 10 records`), the Vault triggers a localized AI SOC Analyst. Using either local LLMs (Ollama/LM Studio) or cloud fallbacks, the AI analyzes the caller IP, query signature, and metadata to classify the intent as either *Surgical* or *Mass Surveillance*.
3. **CRITICAL (Garbage Mutation)**: If the query requests `> 10 records`, or if the AI detects *Mass Surveillance* during an Elevated query, the Heisenberg Countermeasure activates. Ephemeral salt-derived keys are generated, blinding the payloads instantly with O(1) timing overhead.

```
                     ┌────────────────────────────────────────────────────┐
                     │          HEISENBERG VAULT MIDDLEWARE               │
                     │                                                    │
                     │  ┌──────────┐  classify_tier(result_count)         │
 [Client / Attacker] │  │          │                                      │
 ─────────────────▶  │  │  Router  │─── count < 5  ──▶ SURGICAL  ──▶ ✓ Real plaintext
        GET /query   │  │          │                                      │
                     │  │          │─── 5–10 count ──▶ ELEVATED  ──▶ 🤖 LLM SOC analysis
                     │  │          │                                      │
                     │  │          │─── count > 10 ──▶ CRITICAL  ──▶ 🔴 Cryptographic garbage
                     │  └────┬─────┘                                      │
                     │       │                                            │
                     └───────┼────────────────────────────────────────────┘
                             │
                             ▼
                   ┌──────────────────┐
                   │  SQLite / Postgres│
                   │  (vault.db)      │
                   └──────────────────┘
```

All tiers return **HTTP 200**. The attacker never knows a countermeasure is active.

## Quick Start Guide

You can launch the entire ecosystem (FastAPI, React Dashboard, and SQLite Vault) with a single command.

```bash
# 1. Clone the repository and navigate into the directory
git clone https://github.com/Pentogram-team/corodora-hackathon-by-unstop.git
cd corodora-hackathon-by-unstop

# 2. Set up your environment variables
cp .env.example .env

# Add your API keys to .env (or leave them blank to fallback to a local Ollama instance)

# 3. Boot the stack
docker-compose up --build
```

The system will start with hot-reloading enabled.
- Access the **Control Dashboard** at: `http://localhost:5173`
- The backend API routes through: `http://localhost:8000`

### Manual Setup (without Docker)

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

## Cloud Deployment

### Backend → Render.com

The `render.yaml` at the project root configures a zero-touch deployment:

1. Push your repository to GitHub.
2. Go to [render.com](https://render.com) → **New Web Service** → connect your repo.
3. Render auto-detects `render.yaml` and provisions the service.
4. Set the following **environment variables** in the Render dashboard:
   | Variable | Description |
   |---|---|
   | `VAULT_MASTER_KEY` | Auto-generated Fernet key (mark as Secret) |
   | `VAULT_JWT_SECRET` | JWT signing secret (mark as Secret) |
   | `GROQ_API_KEY` | Optional — free LLM inference at console.groq.com |
   | `FRONTEND_URL` | Your Vercel deployment URL |

The backend health check is wired to `GET /api/health` and returns the full stack status.

### Frontend → Vercel

1. Import the `frontend/` directory into [vercel.com](https://vercel.com).
2. Vercel auto-detects the `vercel.json` config (framework: Vite, output: `dist`).
3. Set `VITE_API_BASE` to your Render backend URL:
   ```
   VITE_API_BASE=https://heisenberg-vault-backend.onrender.com
   ```
4. Deploy. The frontend will connect via both REST and WebSocket automatically.

## Features at a Glance

| Feature | Details |
|---|---|
| **3-Tier Query Routing** | SURGICAL / ELEVATED / CRITICAL with automatic escalation |
| **AI SOC Analyst** | 7 LLM backends: Ollama, LM Studio, Kimi, Groq, OpenRouter, OpenAI + heuristic fallback |
| **Tamper-Evident Audit Log** | SHA-256 blockchain-style hash chain stored in SQLite |
| **Real-Time WebSocket Push** | Live audit events streamed to the dashboard |
| **JWT Admin Auth** | Protects all `/api/audit` endpoints; query endpoint stays public |
| **Live Benchmark** | `GET /api/benchmark` proves cryptographic overhead is sub-millisecond |
| **Guest Mode** | Demo-day SQL sandbox with SURVEILLANCE detection overlay |
| **Docker + Cloud Ready** | One `docker-compose up` locally, `render.yaml` + `vercel.json` for production |

---

## 🏆 Devpost Submission

### Inspiration

In October 2023, a credential-stuffing attack exposed 6.9 million 23andMe user records through a single exploit: bulk SQL queries that the database happily answered. Every firewall, every rate-limiter, every WAF rule told the attacker they were close — returning `403 Forbidden` errors that screamed *"this is the perimeter."* We asked a different question: what if the database never refused? What if it cooperated perfectly — and the data it returned was completely useless? The Heisenberg principle states that the act of observation changes what is observed. We built a medical records vault that lives that principle.

### What It Does

Heisenberg Vault applies the quantum principle of observation to cybersecurity: when an attacker attempts to bulk-exfiltrate records, the system responds with `HTTP 200 OK` and structurally valid Fernet-encrypted tokens that decrypt to cryptographic noise — the attacker leaves *believing* they succeeded. Every query is routed through a three-tier classification system — SURGICAL for targeted lookups (full plaintext), ELEVATED for medium queries (AI intent analysis), and CRITICAL for bulk sweeps (ephemeral-key garbage injection). An embedded AI SOC Analyst powered by a 7-provider LLM fallback chain classifies query intent in real-time and escalates threats silently, logging each event to a tamper-evident SHA-256 hash chain that is broadcast live to an admin dashboard via WebSocket.

### How We Built It

- **Backend**: Python 3.11 · FastAPI · SQLite · Cryptography (Fernet/AES-128-CBC) · PyJWT
- **AI Layer**: OpenAI SDK (unified interface) · Ollama · LM Studio · Groq · Kimi · OpenRouter · OpenAI · sweep-ratio heuristic fallback
- **Frontend**: React 18 · Vite · Tailwind CSS · Vanilla SVG charts · WebSocket API
- **Infrastructure**: Docker Compose · Render.com (`render.yaml`) · Vercel (`vercel.json`)
- **Security**: HMAC-SHA256 key derivation · Fernet ephemeral keys · JWT Bearer auth · audit hash chain

### Challenges

The hardest engineering challenge was **ephemeral key timing**. The cryptographic garbage payloads must be indistinguishable from real Fernet tokens — same structure, same length, same encoding — but generated with per-request, per-record salt-derived keys in under 5ms per record. We achieved this with a two-round HMAC chain seeded from a per-process entropy pool, keeping mutation overhead below 2ms average even for 50-record sweeps. The second major challenge was the **LLM fallback chain**: seven different providers with subtly different API surfaces, JSON parsing quirks, and model refusal behaviors, all needing to gracefully degrade to a sweep-ratio heuristic with zero dropped requests.

### Accomplishments We're Proud Of

- **Zero HTTP tells**: every tier — SURGICAL, ELEVATED, and CRITICAL — returns identical HTTP 200 status codes with plausible response shapes.
- **Live attack simulation**: `backend/attack_simulation.py` runs the full attack scenario in under 10 seconds and verifies the hash chain integrity automatically.
- **Tamper-evident audit log**: a SQLite-backed hash chain (inspired by blockchain) that detects any retroactive log modification at the row level.
- **7 LLM backends in a single registry**: add a new provider by adding one tuple to `_LLM_REGISTRY`.
- **Real-time WebSocket dashboard**: the admin UI receives live push events for every query that hits the vault, with the LIVE badge turning green on connection.

### What We Learned

Building Heisenberg Vault taught us that **the most dangerous security systems are the ones that feel cooperative**. Every design decision reinforced the same lesson: confirmation is the attacker's greatest asset. We also learned that LLM-powered security tools require extreme care around prompt injection (the `<<< >>>` delimiter sandboxing was critical) and that graceful multi-provider fallback is a first-class engineering concern, not an afterthought.

### What's Next

- **Production pip package**: `pip install heisenberg-vault` as middleware for any SQLAlchemy application.
- **PostgreSQL adapter**: extend the `VaultDB` abstraction to production-grade relational databases.
- **Enterprise dashboard**: multi-tenant audit log viewer with cross-org threat intelligence sharing.
- **Homomorphic tier evaluation**: classify query intent without the server ever seeing plaintext record IDs.
- **Hardware Security Module (HSM) integration**: bind the VAULT_MASTER_KEY to a physical HSM for FIPS 140-2 compliance.
