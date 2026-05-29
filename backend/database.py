"""
backend/database.py
-------------------
Heisenberg Vault — SQLite persistence layer.

Responsibilities:
  - Bootstrap vault.db with the `sensitive_records` table.
  - Encrypt `protected_payload` fields at-rest using Fernet symmetric encryption.
  - Load the master encryption key from the VAULT_MASTER_KEY environment variable.
  - Pre-populate the table with 50 deterministic mock user profiles on first run.

Usage (standalone):
    # 1. Generate a key once and export it:
    #    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    #    export VAULT_MASTER_KEY="<printed key>"
    #
    # 2. Run this module directly to seed the database:
    #    python -m backend.database
"""

import os
import sqlite3
import hashlib
import textwrap
from pathlib import Path
from cryptography.fernet import Fernet, InvalidToken

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Fallback demo key — NEVER use a hard-coded key in production.
# The real key MUST be supplied via the VAULT_MASTER_KEY environment variable.
_DEMO_FALLBACK_KEY: bytes = b"dmF1bHQtZGVtby1rZXktZG8tbm90LXVzZS1pbi1wcm9kdWN0aW9u"

DB_PATH: Path = Path(__file__).parent.parent / "vault.db"


def _load_fernet() -> Fernet:
    """
    Load the Fernet cipher from VAULT_MASTER_KEY env var.

    If the env var is absent the module falls back to a static demo key and
    prints a loud warning — this keeps the standalone seed script runnable
    out-of-the-box while making the insecurity obvious.
    """
    raw = os.environ.get("VAULT_MASTER_KEY", "").strip()

    if not raw:
        print(
            "\n[VAULT WARNING] VAULT_MASTER_KEY is not set.\n"
            "               Falling back to the built-in DEMO key.\n"
            "               DO NOT use this configuration in production.\n"
            "               Generate a real key with:\n"
            "                 python -c \"from cryptography.fernet import Fernet; "
            "print(Fernet.generate_key().decode())\"\n"
            "               then export VAULT_MASTER_KEY=<key>\n"
        )
        raw = _DEMO_FALLBACK_KEY.decode()

    try:
        return Fernet(raw.encode())
    except Exception as exc:
        raise ValueError(
            f"[VAULT ERROR] VAULT_MASTER_KEY is set but invalid: {exc}\n"
            "Ensure you copied the full base64-url-safe Fernet key."
        ) from exc


# Module-level cipher — instantiated once per process.
_fernet: Fernet = _load_fernet()


# ---------------------------------------------------------------------------
# Encryption helpers
# ---------------------------------------------------------------------------

def encrypt_payload(plaintext: str) -> str:
    """Encrypt a UTF-8 string with Fernet and return the token as a string."""
    return _fernet.encrypt(plaintext.encode()).decode()


def decrypt_payload(token: str) -> str:
    """Decrypt a Fernet token string and return the UTF-8 plaintext."""
    try:
        return _fernet.decrypt(token.encode()).decode()
    except InvalidToken as exc:
        raise ValueError("Decryption failed — token is invalid or key has rotated.") from exc


def rotate_fernet(new_key: bytes) -> None:
    """
    Hot-swap the module-level cipher with a new Fernet key.

    Called by the Heisenberg Vault middleware when key mutation is triggered.
    After rotation, decrypt_payload will fail on previously encrypted tokens
    (intentional Heisenberg behaviour).
    """
    global _fernet
    _fernet = Fernet(new_key)


def get_current_fernet() -> Fernet:
    """Return the currently active Fernet instance (used by the middleware)."""
    return _fernet


# ---------------------------------------------------------------------------
# Database bootstrap
# ---------------------------------------------------------------------------

def get_connection() -> sqlite3.Connection:
    """Open (or create) vault.db and return a connection with row_factory set."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """
    Create the `sensitive_records` table if it does not exist,
    then seed it with 50 mock profiles if the table is empty.
    """
    with get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sensitive_records (
                id                  INTEGER PRIMARY KEY,
                name                TEXT    NOT NULL,
                email               TEXT    NOT NULL UNIQUE,
                medical_record_id   TEXT    NOT NULL UNIQUE,
                protected_payload   TEXT    NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS audit_log (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp           TEXT    NOT NULL,
                caller_ip           TEXT    NOT NULL,
                query_fingerprint   TEXT    NOT NULL,
                tier                TEXT    NOT NULL,
                record_count        INTEGER NOT NULL,
                soc_classification  TEXT,
                soc_confidence      REAL,
                soc_narrative       TEXT,
                prev_hash           TEXT    NOT NULL,
                row_hash            TEXT    NOT NULL
            )
            """
        )
        conn.commit()

        row_count = conn.execute("SELECT COUNT(*) FROM sensitive_records").fetchone()[0]
        if row_count == 0:
            _seed_records(conn)


def _seed_records(conn: sqlite3.Connection) -> None:
    """Insert 50 deterministic mock user profiles into sensitive_records."""
    print("[VAULT] Seeding 50 mock profiles into sensitive_records …")

    records = _generate_mock_profiles(50)
    conn.executemany(
        """
        INSERT INTO sensitive_records
            (id, name, email, medical_record_id, protected_payload)
        VALUES
            (:id, :name, :email, :medical_record_id, :protected_payload)
        """,
        records,
    )
    conn.commit()
    print(f"[VAULT] [OK] Seeded {len(records)} records into {DB_PATH}")


# ---------------------------------------------------------------------------
# Mock data generation
# ---------------------------------------------------------------------------

_FIRST_NAMES = [
    "Alice", "Bob", "Carol", "David", "Eve", "Frank", "Grace", "Hank",
    "Irene", "Jack", "Karen", "Leo", "Mona", "Nate", "Olivia", "Paul",
    "Quinn", "Rita", "Sam", "Tina", "Uma", "Victor", "Wendy", "Xander",
    "Yara", "Zoe", "Aaron", "Bella", "Carl", "Diana", "Ethan", "Fiona",
    "George", "Holly", "Ivan", "Julia", "Kevin", "Laura", "Marcus",
    "Nina", "Oscar", "Petra", "Raj", "Sofia", "Tom", "Ursula", "Vince",
    "Willa", "Xena", "Yusuf",
]

_LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
    "Davis", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson",
    "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee",
    "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez",
    "Lewis", "Robinson", "Walker", "Young", "Allen", "King", "Wright",
    "Scott", "Torres", "Nguyen", "Hill", "Flores", "Green", "Adams",
    "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell", "Carter",
    "Roberts", "Evans",
]

_DIAGNOSES = [
    "Hypertension Stage I",
    "Type 2 Diabetes Mellitus",
    "Generalized Anxiety Disorder",
    "Major Depressive Episode",
    "Chronic Migraine",
    "Asthma — mild persistent",
    "Hypothyroidism",
    "Irritable Bowel Syndrome",
    "Sleep Apnea",
    "Rheumatoid Arthritis",
]

_MEDICATIONS = [
    "Lisinopril 10 mg daily",
    "Metformin 500 mg twice daily",
    "Sertraline 50 mg daily",
    "Escitalopram 20 mg daily",
    "Sumatriptan 100 mg PRN",
    "Albuterol inhaler PRN",
    "Levothyroxine 50 mcg daily",
    "Mebeverine 135 mg three times daily",
    "CPAP therapy nightly",
    "Methotrexate 15 mg weekly",
]

_BLOOD_TYPES = ["A+", "A−", "B+", "B−", "AB+", "AB−", "O+", "O−"]
_INSURANCE = [
    "BlueCross BlueShield",
    "UnitedHealth Group",
    "Aetna",
    "Cigna",
    "Humana",
    "Kaiser Permanente",
    "Molina Healthcare",
    "Centene Corporation",
]


def _stable_hash(seed: str, modulus: int) -> int:
    """Deterministic pseudo-random int derived from a string seed."""
    digest = int(hashlib.sha256(seed.encode()).hexdigest(), 16)
    return digest % modulus


def _generate_mock_profiles(count: int) -> list[dict]:
    """
    Generate `count` deterministic mock user profiles.

    Each profile's protected_payload is a structured plaintext block
    containing sensitive medical/financial details that are encrypted
    before being stored in the database.
    """
    profiles: list[dict] = []

    for i in range(1, count + 1):
        seed = f"vault-record-{i}"

        first = _FIRST_NAMES[_stable_hash(seed + "fn", len(_FIRST_NAMES))]
        last  = _LAST_NAMES [_stable_hash(seed + "ln", len(_LAST_NAMES))]
        name  = f"{first} {last}"

        # Deterministic but realistic-looking identifiers
        email_domain = ["gmail.com", "yahoo.com", "outlook.com", "proton.me"][
            _stable_hash(seed + "dom", 4)
        ]
        email = f"{first.lower()}.{last.lower()}{_stable_hash(seed + 'em', 99)}@{email_domain}"

        mrn = (
            f"MRN-"
            f"{_stable_hash(seed + 'mrn1', 9000) + 1000:04d}-"
            f"{_stable_hash(seed + 'mrn2', 9000) + 1000:04d}"
        )

        diagnosis   = _DIAGNOSES   [_stable_hash(seed + "diag", len(_DIAGNOSES))]
        medication  = _MEDICATIONS [_stable_hash(seed + "med",  len(_MEDICATIONS))]
        blood_type  = _BLOOD_TYPES [_stable_hash(seed + "bt",   len(_BLOOD_TYPES))]
        insurance   = _INSURANCE   [_stable_hash(seed + "ins",  len(_INSURANCE))]
        dob_year    = 1955 + _stable_hash(seed + "dob", 50)
        dob_month   = _stable_hash(seed + "mon", 12) + 1
        dob_day     = _stable_hash(seed + "day", 28) + 1
        ssn_last4   = f"{_stable_hash(seed + 'ssn', 9000) + 1000:04d}"

        # Structured plaintext — will be Fernet-encrypted before insertion
        payload_plaintext = textwrap.dedent(f"""
            HEISENBERG VAULT — PROTECTED MEDICAL RECORD
            ============================================
            Subject      : {name}
            Date of Birth: {dob_year:04d}-{dob_month:02d}-{dob_day:02d}
            Blood Type   : {blood_type}
            SSN (last 4) : ***-**-{ssn_last4}
            Insurance    : {insurance}
            --------------------------------------------
            Primary Dx   : {diagnosis}
            Current Med  : {medication}
            Allergies    : {"Penicillin" if i % 3 == 0 else "NKDA"}
            Last Visit   : 2025-{(i % 12) + 1:02d}-{(i % 28) + 1:02d}
            Clearance Lvl: {"RESTRICTED" if i % 5 == 0 else "CONFIDENTIAL"}
            ============================================
        """).strip()

        profiles.append(
            {
                "id":                i,
                "name":              name,
                "email":             email,
                "medical_record_id": mrn,
                "protected_payload": encrypt_payload(payload_plaintext),
            }
        )

    return profiles


# ---------------------------------------------------------------------------
# Query helpers (consumed by main.py / middleware)
# ---------------------------------------------------------------------------

def fetch_record_by_id(record_id: int) -> dict | None:
    """
    Return a single record by primary key with its payload DECRYPTED.
    Returns None if the record does not exist.
    """
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM sensitive_records WHERE id = ?", (record_id,)
        ).fetchone()

    if row is None:
        return None

    data = dict(row)
    data["protected_payload"] = decrypt_payload(data["protected_payload"])
    return data


def fetch_records_paginated(
    offset: int = 0,
    limit: int = 10,
    decrypt: bool = True,
) -> list[dict]:
    """
    Return a page of records.

    Args:
        offset: Row offset for pagination.
        limit:  Maximum number of rows to return.
        decrypt: If True, decrypt protected_payload before returning.
                 The Heisenberg middleware passes decrypt=False and returns
                 a mutated cipher token when a sweep is detected.
    """
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM sensitive_records ORDER BY id LIMIT ? OFFSET ?",
            (limit, offset),
        ).fetchall()

    results = []
    for row in rows:
        data = dict(row)
        if decrypt:
            try:
                data["protected_payload"] = decrypt_payload(data["protected_payload"])
            except ValueError:
                data["protected_payload"] = "[DECRYPTION FAILED — KEY ROTATED]"
        results.append(data)

    return results


def fetch_all_ids() -> list[int]:
    """Return a list of all record IDs (used by the middleware sweep detector)."""
    with get_connection() as conn:
        rows = conn.execute("SELECT id FROM sensitive_records ORDER BY id").fetchall()
    return [r["id"] for r in rows]


def count_records() -> int:
    """Return the total number of records in the table."""
    with get_connection() as conn:
        return conn.execute("SELECT COUNT(*) FROM sensitive_records").fetchone()[0]


# ---------------------------------------------------------------------------
# Entrypoint — run `python -m backend.database` to seed the vault
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print(f"[VAULT] Initialising database at {DB_PATH} …")
    init_db()
    total = count_records()
    print(f"[VAULT] vault.db ready — {total} records present.")

    # Quick sanity check: decrypt and display record #1
    rec = fetch_record_by_id(1)
    if rec:
        print("\n[VAULT] Sample decrypted record (id=1):")
        print(f"  Name  : {rec['name']}")
        print(f"  Email : {rec['email']}")
        print(f"  MRN   : {rec['medical_record_id']}")
        print(f"  Payload preview:\n")
        for line in rec["protected_payload"].splitlines():
            print(f"    {line}")
