# Contributing to Heisenberg Vault

Welcome to the Heisenberg Vault project! We're thrilled that you want to contribute to our zero-trust, quantum-inspired medical records vault. This guide will help you get started quickly and ensure your contributions align with our architecture.

## Overview
Heisenberg Vault operates on a core principle: **Observation destroys the data**. When attackers attempt to sweep the database, the system dynamically mutates the payload into cryptographic garbage. All contributions should respect this philosophy—the system must never crash, and it must never signal to an attacker that countermeasures have been engaged (always return HTTP 200).

## Adding a New Database Adapter
Currently, we rely on SQLite for simplicity. To add a new adapter (e.g., PostgreSQL, MySQL):
1. **Understand VaultDB**: The system expects a synchronous abstraction that returns dictionary-like rows. 
2. **Implement the Interface**: Create a new file in `backend/adapters/` that exposes `get_connection()`, `fetch_records_paginated()`, and `fetch_all_ids()`.
3. **Graceful Degradation**: Ensure your adapter catches connection errors and fails cleanly, returning empty result sets rather than throwing 500s.

## Adding a New LLM Backend
Our SOC intent analysis supports multiple providers. To add a new one:
1. **Update `_LLM_REGISTRY`**: Open `backend/main.py` and add your provider's credentials to the `_LLM_REGISTRY` list.
2. **Format**: `("ENV_VAR_API_KEY", "https://api.endpoint/v1", "model-name", "provider-id", "Display Label")`
3. **OpenAI SDK**: We use the official OpenAI async client for all remote APIs. If your provider uses a custom schema, ensure you shim the response format to match.

## Running Tests
To run the automated attack simulation and integrity checks:
```bash
python backend/attack_simulation.py
```
Ensure all scenarios (Surgical, Mass Surveillance, and Audit Log Verification) pass with a `[+]` success indicator before opening a PR.

## Code Style
- **Python**: We follow PEP-8 guidelines. Use `black` for formatting and `flake8` for linting. Keep type hints consistent across all functions.
- **React**: We use functional components, hooks, and Tailwind CSS. Keep styling consistent with the dark `slate-900` aesthetic.

## Submitting a PR
1. Fork the repository and create your feature branch (`git checkout -b feature/amazing-feature`).
2. Ensure your code does not break the cryptographic audit chain.
3. Commit your changes (`git commit -m 'feat: add amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request on GitHub.

Thank you for helping us secure the future of data! 🚀
