# Contributing to Heisenberg Vault

Thank you for your interest in contributing. Heisenberg Vault is a hackathon project built on a serious engineering principle — **the system must never crash, and it must never signal to an attacker that countermeasures are active**. Every contribution should respect that invariant: all tiers always return `HTTP 200`.

This document covers everything you need to go from zero to a merged pull request.

---

## Table of Contents

- [Core Invariants](#core-invariants)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Adding a New Database Adapter](#adding-a-new-database-adapter)
- [Adding a New LLM Backend](#adding-a-new-llm-backend)
- [Running Tests](#running-tests)
- [Code Style](#code-style)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Security Reporting](#security-reporting)

---

## Core Invariants

Before writing a single line of code, internalise these rules. PRs that violate them will not be merged:

1. **HTTP 200, always.** SURGICAL, ELEVATED, and CRITICAL responses are identical in status code and outer JSON shape. Never raise a `4xx` or `5xx` in response to a query — doing so leaks intelligence to the attacker.

2. **Cryptographic operations belong in `backend/main.py`.** The garbage-payload engine (`_apply_critical_obfuscation`), key mutation (`rotate_fernet`), and HMAC derivation must not be inlined into routes or helper functions.

3. **Fail gracefully, not loudly.** If an LLM backend is unavailable, fall through to the next in the registry. If all LLM calls fail, apply the heuristic. If the heuristic fails, default to SURGICAL. Never raise an unhandled exception from the classification pipeline.

4. **No hardcoded secrets.** All sensitive values — keys, passwords, API keys — must come from environment variables. Use `.env.example` as the canonical reference.

5. **Log every tier decision.** All classification outcomes must emit a `log.info()` or `log.warning()` entry with the caller IP, count, and tier. The audit log is a security artefact, not a debug aid.

---

## Development Setup

### Docker (Recommended)

The fastest path — one command launches the FastAPI backend, SQLite vault, and React dashboard with hot-reloading:

```bash
# 1. Clone and enter the repository
git clone https://github.com/Pentogram-team/corodora-hackathon-by-unstop.git
cd corodora-hackathon-by-unstop

# 2. Copy the environment template
cp .env.example .env

# 3. (Optional) Add API keys for the AI SOC Analyst
#    Leave all keys blank to use the heuristic fallback — it works out of the box.
nano .env

# 4. Boot the full stack
docker-compose up --build
```

| Service | URL |
|---------|-----|
| React Dashboard | http://localhost:5173 |
| FastAPI Backend | http://localhost:8000 |
| Interactive API Docs | http://localhost:8000/docs |

Default login: `vault_admin` / `heisenberg2026`

---

### Manual Setup (without Docker)

**Backend:**

```bash
# Install Python dependencies
pip install -r backend/requirements.txt

# Generate a Fernet master key and export it
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
export VAULT_MASTER_KEY="<paste key here>"

# Start the API server with hot-reload
uvicorn backend.main:app --reload --port 8000
```

**Frontend** (new terminal):

```bash
cd frontend
npm install

# Point the dev server at the local backend
echo "VITE_API_BASE=http://localhost:8000" > .env.local

npm run dev
```

---

## Project Structure

```
heisenberg-vault/
├── backend/
│   ├── main.py               # FastAPI app — 3-tier router, crypto engine, LLM chain
│   │                         #   • RateTracker      — temporal sweep detection
│   │                         #   • _LLM_REGISTRY    — 4-entry remote LLM fallback chain
│   │                         #   • _build_llm_client() — resolves active backend
│   │                         #   • classify_soc()   — runs LLM intent analysis
│   │                         #   • trigger_soc_alert() — async Discord/Slack webhook
│   │                         #   • _apply_critical_obfuscation() — garbage engine
│   │                         #   • _write_audit_log()  — SHA-256 hash chain writer
│   ├── database.py           # Persistence layer — SQLite + PostgreSQL abstraction
│   │                         #   • PostgresCursorWrapper / PostgresConnectionWrapper
│   │                         #   • get_connection()  — context manager, dialect-aware
│   │                         #   • init_db()         — DDL bootstrap + mock seed
│   │                         #   • encrypt/decrypt_payload() — Fernet helpers
│   │                         #   • rotate_fernet()   — hot-swap cipher (Heisenberg mutation)
│   ├── attack_simulation.py  # Live 3-scenario attack runner (requires server on :8000)
│   ├── __init__.py
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx                    # Root — WebSocket lifecycle, query state, tier routing
│   │   └── components/
│   │       ├── Header.jsx             # Brand bar, LIVE WebSocket badge, demo controls
│   │       ├── StatusBanner.jsx       # Tier status banner + benchmark button
│   │       ├── QueryBuilder.jsx       # Limit/offset form + raw SQL input + GUEST MODE
│   │       ├── PayloadPane.jsx        # Response viewer with ATTACKER VIEW mode
│   │       ├── AuditLog.jsx           # Real-time audit table — SESSION and PERSISTENT
│   │       ├── ThreatGraph.jsx        # SVG time-series mutation graph
│   │       └── LoginScreen.jsx        # JWT admin authentication form
│   ├── vercel.json                    # Vercel deployment configuration (Vite)
│   └── package.json
├── docker-compose.yml         # Full-stack local orchestration
├── render.yaml                # Render.com zero-touch backend deployment
├── test_tiers.py              # Integration smoke test — all three tiers
├── .env.example               # Canonical environment variable reference
├── vault.db                   # Pre-seeded SQLite database (dev only — never commit live data)
├── README.md
├── CONTRIBUTING.md            # This file
└── LICENSE
```

---

## Adding a New Database Adapter

The persistence layer is fully abstracted in [`backend/database.py`](backend/database.py). The existing code supports both SQLite (default) and PostgreSQL via a duck-typed wrapper pattern.

To add a new adapter (e.g., MySQL, MongoDB, DynamoDB):

### Step 1 — Implement the required interface

Your adapter must expose the following functions and context manager at module level. `main.py` imports these directly and must not need to be changed:

```python
# backend/database.py (or a new backend/adapters/mysql.py, etc.)

def get_connection():
    """
    Context manager returning a connection object that supports:
      .execute(query, params=None)   → returns a cursor-like object
      .executemany(query, params)    → bulk insert
      .commit()
      .close()
    Rows returned by .execute(...).fetchone() and .fetchall()
    must be subscriptable as dicts (row["column_name"]).
    """

def fetch_records_paginated(offset: int, limit: int, decrypt: bool) -> list[dict]:
    """Return a page of records from sensitive_records."""

def fetch_all_ids() -> list[int]:
    """Return all record IDs (used by the sweep-ratio heuristic)."""

def count_records() -> int:
    """Return total record count."""

def encrypt_payload(plaintext: str) -> str:
    """Encrypt with Fernet — do not change the crypto primitive."""

def decrypt_payload(token: str) -> str:
    """Decrypt with Fernet — raises ValueError on invalid token."""

def rotate_fernet(new_key: bytes) -> None:
    """Hot-swap the active Fernet cipher (Heisenberg mutation)."""

DatabaseError: type  # Alias to your adapter's base exception class
```

### Step 2 — Add dialect selection logic

At the top of `database.py`, add an environment variable check:

```python
DB_BACKEND = os.environ.get("DB_BACKEND", "sqlite")  # sqlite | postgres | mysql

if DB_BACKEND == "mysql":
    # import and configure your MySQL adapter
    ...
elif DB_BACKEND == "postgres":
    # existing psycopg2 path
    ...
else:
    # existing sqlite3 path (default)
    ...
```

### Step 3 — Update Docker Compose (if needed)

If your adapter requires a running server, add the service to `docker-compose.yml`:

```yaml
services:
  mysql:
    image: mysql:8.3
    environment:
      MYSQL_ROOT_PASSWORD: vault
      MYSQL_DATABASE: vault
    ports:
      - "3306:3306"
```

### Step 4 — Update `.env.example`

Document the new environment variables so contributors know what to set.

### Step 5 — Add an integration test

Add a scenario to `test_tiers.py` that:
- Boots against your adapter
- Confirms all three tiers return `HTTP 200`
- Confirms SURGICAL returns decrypted plaintext
- Confirms CRITICAL returns structurally valid Fernet tokens that **cannot** be decrypted with the master key

---

## Adding a New LLM Backend

The ELEVATED-tier SOC Analyst uses a cascading resolver in `_build_llm_client()` ([`backend/main.py` L197–L268](backend/main.py)). Local backends (Ollama, LM Studio) are checked first via environment variables; remote backends are walked from `_LLM_REGISTRY`.

All backends must be **OpenAI API-compatible** — the system uses `openai.AsyncOpenAI` with a custom `base_url` for every remote provider.

### Adding a Remote API Backend

Append a tuple to `_LLM_REGISTRY` in `backend/main.py`:

```python
_LLM_REGISTRY = [
    # Existing entries — order determines priority (first set key wins)
    (
        "KIMI_API_KEY",
        "https://api.moonshot.cn/v1",
        "moonshot-v1-8k",
        "kimi",
        "Kimi moonshot-v1-8k  [FREE — platform.moonshot.cn]",
    ),
    (
        "GROQ_API_KEY",
        "https://api.groq.com/openai/v1",
        "llama-3.3-70b-versatile",
        "groq",
        "Groq llama-3.3-70b-versatile  [FREE — console.groq.com]",
    ),
    (
        "OPENROUTER_API_KEY",
        "https://openrouter.ai/api/v1",
        "qwen/qwq-32b:free",
        "openrouter",
        "OpenRouter qwen/qwq-32b:free  [FREE — openrouter.ai]",
    ),
    (
        "OPENAI_API_KEY",
        None,           # None = use the default OpenAI base URL
        "gpt-4o-mini",
        "openai",
        "OpenAI gpt-4o-mini  [paid]",
    ),

    # ── Add your new backend here ──────────────────────────────────────────
    (
        "YOUR_API_KEY_ENV_VAR",            # environment variable name
        "https://api.yourprovider.com/v1", # OpenAI-compatible base URL
        "your-model-name",                 # model string passed to the API
        "your-backend-id",                 # short internal label (snake_case)
        "YourProvider model-name  [FREE — yourprovider.com]",  # log label
    ),
]
```

Each tuple field:

| Position | Field | Description |
|----------|-------|-------------|
| `[0]` | `env_var` | Name of the env var holding the API key |
| `[1]` | `base_url` | OpenAI-compatible endpoint (`None` for OpenAI itself) |
| `[2]` | `model` | Model string sent in every chat completion request |
| `[3]` | `name` | Internal ID — returned in API response as `llm_backend` |
| `[4]` | `label` | Human-readable log line (used in `log.info`) |

### Checklist for new LLM backends

- [ ] Backend returns valid JSON matching `{"classification": "SURGICAL"|"MASS_SURVEILLANCE", "confidence": float, "narrative": "..."}`
- [ ] The `_SOC_SYSTEM_PROMPT` prompt injection sandbox (`<<< >>>` delimiters) is respected
- [ ] API key added to `.env.example` with a comment linking to the signup page
- [ ] API key added to `render.yaml` under `envVars` with `sync: false`
- [ ] `README.md` AI SOC Analyst section updated to list the new provider

### Adding a Local Backend (non-OpenAI-compatible)

If your local backend does not implement the OpenAI chat completions API, add a resolution branch **before** the `_LLM_REGISTRY` loop in `_build_llm_client()`, following the pattern of the existing Ollama and LM Studio branches.

---

## Running Tests

### Automated attack simulation

Runs three live scenarios against a running server on `:8000`:

```bash
# Start the server first (if not using Docker)
uvicorn backend.main:app --reload --port 8000 &

# Run the full attack simulation
python backend/attack_simulation.py
```

Expected output — all three scenarios must show `[+]`:

```
============================================================
 SCENARIO A: SURGICAL LOOKUP
============================================================
[+] HTTP 200 OK
[+] Decrypted Payload: [real data]

============================================================
 SCENARIO B: MASS SURVEILLANCE SWEEP
============================================================
[+] HTTP 200 OK (Heisenberg effect: caller deceived)
[+] Blinded Payload (Cryptographic Garbage): [garbage Fernet tokens]

============================================================
 SCENARIO C: CRYPTOGRAPHIC AUDIT LOG VERIFICATION
============================================================
[+] INTEGRITY_VERIFIED: Chain is completely valid (Total Entries: N)
```

### Tier smoke tests

Confirms all three tiers and the LLM classification path:

```bash
python test_tiers.py
```

### Manual cURL checks

```bash
BASE="http://localhost:8000"

# SURGICAL — returns real plaintext
curl -s "$BASE/api/query?limit=3" | python -m json.tool

# ELEVATED — AI SOC analysis fires
curl -s "$BASE/api/query?limit=7" | python -m json.tool

# CRITICAL — cryptographic garbage injected
curl -s "$BASE/api/query?limit=20" | python -m json.tool

# Audit log (requires JWT)
TOKEN=$(curl -s -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"vault_admin","password":"heisenberg2026"}' \
  | python -m json.tool | grep token | awk -F'"' '{print $4}')

curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/audit" | python -m json.tool

# Hash chain integrity
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/audit/verify" | python -m json.tool

# Benchmark
curl -s "$BASE/api/benchmark" | python -m json.tool
```

### What to verify before opening a PR

- [ ] `python backend/attack_simulation.py` — all `[+]` indicators
- [ ] `python test_tiers.py` — no assertion errors
- [ ] SURGICAL returns decrypted plaintext (`protected_payload` is human-readable)
- [ ] CRITICAL returns valid Fernet token structure that **fails** decryption with the master key
- [ ] Audit chain reports `"chain_valid": true` after a full run
- [ ] No `500` responses anywhere in server logs

---

## Code Style

### Python

- Follow **PEP 8**. Use `black` for auto-formatting (`black backend/`) and `flake8` for lint (`flake8 backend/ --max-line-length=120`).
- **Type hints on every public function** — no bare `def f(x):` signatures.
- **Docstrings on all public functions** — one-line summary + args/returns for non-trivial functions.
- `log.info()` for every tier decision. `log.warning()` for fallback paths. `log.error()` never swallowed silently.
- All crypto operations via `backend/main.py` helpers — never inline `Fernet`, `hmac`, or `hashlib` in a route handler.
- New env vars: add to `.env.example` with a comment, document in `README.md` Environment Variables table.

### React / JavaScript

- **Functional components only** — no class components.
- **Hooks for all state** — `useState`, `useCallback`, `useEffect`, `useRef`.
- **Tailwind CSS for all styling** — no inline `style={{}}` except for dynamic computed values (e.g., chart pixel positions).
- Keep the dark `slate-900` / `slate-800` aesthetic consistent across all components.
- Components receive data via props — no direct API calls inside components (all fetching lives in `App.jsx`).

### Commit messages

Use the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
feat: add Anthropic Claude backend to LLM registry
fix: correct param binding for PostgreSQL executemany
docs: add MySQL adapter guide to CONTRIBUTING.md
refactor: extract rate tracker into separate module
test: add ELEVATED→CRITICAL escalation scenario
```

---

## Submitting a Pull Request

1. **Fork** the repository on GitHub.

2. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```

3. **Make your changes** — keep commits atomic. One logical change per commit.

4. **Run the full test suite** before pushing:
   ```bash
   python backend/attack_simulation.py
   python test_tiers.py
   ```

5. **Update documentation** if you:
   - Added a new environment variable → update `.env.example` and `README.md`
   - Added a new API endpoint → update the API Reference table in `README.md`
   - Changed startup behaviour → update the Quick Start section

6. **Push your branch** and open a Pull Request:
   ```bash
   git push origin feat/your-feature-name
   ```

7. **Fill out the PR description** — include:
   - What changed and why
   - Which invariants you verified (see [Core Invariants](#core-invariants))
   - Test output confirming all scenarios pass

### Review SLA

| PR Type | Reviewers Required | Target Response |
|---------|-------------------|-----------------|
| Documentation / style | 1 | 24 hours |
| New feature / LLM backend | 1 | 48 hours |
| Crypto engine / auth layer | **2** | 48 hours |
| Security vulnerability fix | **2** | 24 hours (private channel) |

PRs touching the Fernet key derivation, garbage payload engine, JWT authentication, or audit hash chain require **two approvals** before merge.

---

## Security Reporting

**Do not open a public GitHub issue for security vulnerabilities.**

If you discover a vulnerability in Heisenberg Vault — especially in the cryptographic garbage engine, JWT auth layer, or audit hash chain — please follow responsible disclosure:

1. Open a GitHub issue titled `[SECURITY] Brief description` and include **no exploit details**.
2. We will respond within **24 hours** with a private communication channel.
3. Once a fix is merged and released, we will credit you in the release notes.

We treat all security reports seriously. The irony of a security project having unpatched vulnerabilities is not lost on us.

---

*Built by Pentogram Team · Codorra 2026 · Unstop Hackathon · MIT License*
