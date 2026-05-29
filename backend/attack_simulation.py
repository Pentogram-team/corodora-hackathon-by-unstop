import time
import requests
import json

BASE_URL = "http://localhost:8000"

def print_header(title):
    print("\n" + "="*60)
    print(f" {title} ")
    print("="*60)

def main():
    print_header("SCENARIO A: SURGICAL LOOKUP")
    print("[*] Simulating legitimate, highly targeted query...")
    print("[*] Target: SELECT * FROM sensitive_records WHERE id = 1\n")
    time.sleep(1)
    
    try:
        res = requests.get(f"{BASE_URL}/api/query?sql=SELECT * FROM sensitive_records WHERE id = 1")
        if res.status_code == 200:
            print("[+] HTTP 200 OK")
            data = res.json()
            print("[+] Decrypted Payload:")
            print(json.dumps(data.get("records", []), indent=2))
        else:
            print(f"[-] Error: {res.status_code} {res.text}")
    except Exception as e:
        print(f"[-] Connection failed: {e}")

    print_header("SCENARIO B: MASS SURVEILLANCE SWEEP")
    print("[*] Simulating aggressive bulk data exfiltration attempt...")
    print("[*] Target: SELECT * FROM sensitive_records\n")
    time.sleep(2)
    
    try:
        res = requests.get(f"{BASE_URL}/api/query?sql=SELECT * FROM sensitive_records")
        if res.status_code == 200:
            print("[+] HTTP 200 OK (Heisenberg effect: caller deceived)")
            data = res.json()
            print("[+] Blinded Payload (Cryptographic Garbage):")
            print(json.dumps(data.get("records", []), indent=2)[:500] + "...\n[TRUNCATED FOR DISPLAY]")
        else:
            print(f"[-] Error: {res.status_code} {res.text}")
    except Exception as e:
        print(f"[-] Connection failed: {e}")

    print_header("SCENARIO C: CRYPTOGRAPHIC AUDIT LOG VERIFICATION")
    print("[*] Checking integrity of the audit log chain...\n")
    time.sleep(1)
    
    try:
        res = requests.get(f"{BASE_URL}/api/audit/verify")
        if res.status_code == 200:
            data = res.json()
            if data.get("chain_valid"):
                print(f"[+] INTEGRITY_VERIFIED: Chain is completely valid (Total Entries: {data.get('total_entries')}).")
            else:
                print(f"[-] CHAIN_BROKEN: Tampering detected! Broken at entry ID {data.get('first_broken_at')}.")
        else:
            print(f"[-] Error: {res.status_code} {res.text}")
    except Exception as e:
        print(f"[-] Connection failed: {e}")

if __name__ == "__main__":
    main()
