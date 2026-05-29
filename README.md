# Heisenberg Vault: Observation Destroys the Data

![Heisenberg Vault](https://img.shields.io/badge/Security-Zero%20Trust-red.svg?style=for-the-badge) ![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?style=for-the-badge) ![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB.svg?style=for-the-badge)

## The Threat
Standard security scanners are purely reactive—they only tell you *after* you've been breached. Traditional firewalls and rate-limiters are loud; dropping a connection or returning a `403 Forbidden` error explicitly confirms to an attacker that they have found the perimeter of a high-value target. In modern cyber warfare, signaling your defensive posture is a fatal flaw.

## The Solution
Welcome to the **Heisenberg Vault**. 

Built on the quantum principle that the mere act of observation alters the state of a system, the Vault intercepts mass surveillance and bulk data harvesting attempts in real-time. Instead of blocking the attacker, the Vault dynamically mutates its internal Fernet cryptographic keys. 

It returns a pristine `HTTP 200 OK`, feeding the attacker mathematically perfect, structurally sound cryptographic garbage payloads. The attacker is completely blinded, yet they believe they have successfully exfiltrated the database.

## The 3-Tier Architecture

The Vault routes incoming database queries through a dynamically escalating security tier system:

1. **SURGICAL (Clean JSON)**: For highly specific queries (e.g., `< 5 records`), the Vault assumes legitimate clinical access. It cleanly decrypts the payloads and returns the real data instantly.
2. **ELEVATED (AI Intent Analysis)**: For moderate queries (`5 - 10 records`), the Vault triggers a localized AI SOC Analyst. Using either local LLMs (Ollama/LM Studio) or cloud fallbacks, the AI analyzes the caller IP, query signature, and metadata to classify the intent as either *Surgical* or *Mass Surveillance*.
3. **CRITICAL (Garbage Mutation)**: If the query requests `> 10 records`, or if the AI detects *Mass Surveillance* during an Elevated query, the Heisenberg Countermeasure activates. Ephemeral salt-derived keys are generated, blinding the payloads instantly with O(1) timing overhead.

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
