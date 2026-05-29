import urllib.request, json, time
time.sleep(3)

base = "http://localhost:8000"

def get(path):
    with urllib.request.urlopen(base + path) as r:
        return json.loads(r.read())

# ── ELEVATED normal path: limit=7, sweep_ratio=14% → SURGICAL classification ──
e = get("/api/query?limit=7")
print("=== ELEVATED (limit=7) ===")
print("  tier            :", e["tier"])
print("  classification  :", e.get("classification"))
print("  confidence      :", e.get("confidence"))
print("  llm_backend     :", e.get("llm_backend"))
print("  force_critical  :", e.get("force_critical"))
print("  narrative[:80]  :", str(e.get("narrative",""))[:80])
print("  payload preview :", e["records"][0]["protected_payload"][:60])
print()

# ── ELEVATED forced to CRITICAL by heuristic: 30%+ sweep ──
# Use a SQL query that returns 16 records (>30% of 50) while staying in count<=10... 
# Actually heuristic is by ID sweep ratio. Let me get 10 records (max ELEVATED)
# with IDs covering 30%+ of 50 records
e2 = get("/api/query?sql=SELECT+*+FROM+sensitive_records+WHERE+id+IN+(1,2,3,4,5,6,7,8,9,10)+LIMIT+10")
print("=== ELEVATED via SQL (10 records, 20% sweep) ===")
print("  tier            :", e2["tier"])
print("  classification  :", e2.get("classification"))
print("  force_critical  :", e2.get("force_critical"))
print("  llm_backend     :", e2.get("llm_backend"))
print("  narrative[:80]  :", str(e2.get("narrative",""))[:80])
first_payload = e2["records"][0]["protected_payload"]
print("  payload[:60]    :", first_payload[:60])
print()

# ── Simulate MASS_SURVEILLANCE: SQL with 8 records from top 50% of IDs (>=30% sweep) ──
# IDs 1-8 out of 50 = 16% sweep — still SURGICAL by heuristic. 
# Let's hit 15-16 records (CRITICAL by count tier, not ELEVATED):
# Instead, the ELEVATED→CRITICAL escalation via LLM would happen with a real API key.
# With heuristic, sweep_ratio >= 0.30 triggers MASS_SURVEILLANCE.
# To hit ELEVATED + MASS_SURVEILLANCE heuristic: need records in [5,10] range but IDs spanning 30%+ of 50
# That means 15+ unique IDs queried but only <=10 returned — not achievable via simple LIMIT
# The heuristic uses len(returned_ids)/len(all_ids), so 10/50 = 20% which is < 30%.
# So heuristic fallback won't escalate ELEVATED→CRITICAL (sweep stays <=20%).
# This is correct: with a real LLM, the LLM itself decides based on query SEMANTICS.

print("=== CRITICAL by count (limit=15) ===")
c = get("/api/query?limit=15")
print("  tier            :", c["tier"])
print("  clearance       :", c.get("clearance"))
print("  garbage token   :", c["records"][0]["protected_payload"][:60])
