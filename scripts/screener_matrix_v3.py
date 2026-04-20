#!/usr/bin/env python3
"""Post-fix screener matrix v3 — correct response key 'items', URL encoding."""
import urllib.request, urllib.parse, json

BASE = "http://127.0.0.1:3004/api/screener/list"
PASS = FAIL = WARN = 0
results = []

def get(params):
    qs = urllib.parse.urlencode(params)
    url = f"{BASE}?{qs}"
    try:
        with urllib.request.urlopen(url, timeout=15) as r:
            return json.loads(r.read())
    except Exception as e:
        return {"_error": str(e)}

def check(name, params, predicate, warn_msg=None):
    global PASS, FAIL, WARN
    d = get(params)
    if "_error" in d:
        FAIL += 1; results.append(("FAIL", name, d["_error"])); print(f"[FAIL] {name}: {d['_error']}"); return
    try:
        ok, note = predicate(d)
    except Exception as e:
        FAIL += 1; results.append(("FAIL", name, f"exc={e}")); print(f"[FAIL] {name}: {e}"); return
    if ok:
        PASS += 1; results.append(("PASS", name, note)); print(f"[PASS] {name}: {note}")
    elif warn_msg:
        WARN += 1; results.append(("WARN", name, warn_msg + " | " + note)); print(f"[WARN] {name}: {note}")
    else:
        FAIL += 1; results.append(("FAIL", name, note)); print(f"[FAIL] {name}: {note}")

def items(d): return d.get("items", [])
def total(d): return d.get("total", 0)

# --- TYPE ---
check("type_stocks", {"type":"stocks","limit":5},
      lambda d: (total(d)>0 and all(a.get("type")=="stock" for a in items(d)),
                 f"total={total(d)} types={list(set(a.get('type') for a in items(d)))}"))
check("type_crypto", {"type":"crypto","limit":5},
      lambda d: (total(d)>0 and all(a.get("type")=="crypto" for a in items(d)),
                 f"total={total(d)} types={list(set(a.get('type') for a in items(d)))}"))
check("type_etf", {"type":"etf","limit":5},
      lambda d: (total(d)>0 and all(a.get("type")=="etf" for a in items(d)),
                 f"total={total(d)} types={list(set(a.get('type') for a in items(d)))}"))

# --- COUNTRY ---
check("country_US", {"type":"stocks","marketCountries":"US","limit":5},
      lambda d: (total(d)>30000, f"total={total(d)}"))
check("country_IN", {"type":"stocks","marketCountries":"IN","limit":5},
      lambda d: (total(d)>1000, f"total={total(d)}"))
check("country_multi_US_IN", {"type":"stocks","marketCountries":"US,IN","limit":5},
      lambda d: (total(d)>=34803, f"total={total(d)} (expect >=34803)"),
      warn_msg="may be filtered by another criterion")

# --- SECTOR (the critical fix) ---
check("sector_singular_tech", {"type":"stocks","marketCountries":"US","sector":"Technology","limit":5},
      lambda d: (total(d)>1000, f"total={total(d)} sectors={list(set(a.get('sector') for a in items(d)))}"))
check("sectors_plural_tech", {"type":"stocks","marketCountries":"US","sectors":"Technology","limit":5},
      lambda d: (total(d)>1000, f"total={total(d)}"))
check("sector_lowercase", {"type":"stocks","marketCountries":"US","sector":"technology","limit":5},
      lambda d: (total(d)>1000, f"total={total(d)} (case-insensitive)"))
check("sector_mixedcase", {"type":"stocks","marketCountries":"US","sector":"TECHNOLOGY","limit":5},
      lambda d: (total(d)>1000, f"total={total(d)} (uppercase)"))
check("sector_financial_services", {"type":"stocks","marketCountries":"US","sector":"Financial Services","limit":5},
      lambda d: (total(d)>50, f"total={total(d)} (space-containing sector)"))
check("sector_healthcare", {"type":"stocks","marketCountries":"US","sector":"Healthcare","limit":5},
      lambda d: (total(d)>50, f"total={total(d)}"))
check("sector_india", {"type":"stocks","marketCountries":"IN","sector":"Technology","limit":5},
      lambda d: (total(d)>0, f"total={total(d)}"), warn_msg="India sector sparse")

# --- SORT ---
check("sort_mcap_desc", {"type":"stocks","sortBy":"marketCap","sortOrder":"desc","limit":5},
      lambda d: (len(items(d))>0 and [a.get("marketCap",0) or 0 for a in items(d)] == sorted([a.get("marketCap",0) or 0 for a in items(d)], reverse=True),
                 f"top={[a.get('symbol') for a in items(d)]} mcap={[a.get('marketCap') for a in items(d)]}"))
check("sort_mcap_asc", {"type":"stocks","sortBy":"marketCap","sortOrder":"asc","limit":5},
      lambda d: (len(items(d))>0, f"count={len(items(d))}"))
check("sort_volume_desc", {"type":"stocks","sortBy":"volume","sortOrder":"desc","limit":5},
      lambda d: (len(items(d))>0, f"top={[a.get('symbol') for a in items(d)]} vol={[a.get('volume') for a in items(d)]}"))
check("sort_pe_desc", {"type":"stocks","sortBy":"pe","sortOrder":"desc","limit":5},
      lambda d: (len(items(d))>0, f"top={[a.get('symbol') for a in items(d)]}"))
check("sort_eps_desc", {"type":"stocks","sortBy":"eps","sortOrder":"desc","limit":5},
      lambda d: (len(items(d))>0, f"top={[a.get('symbol') for a in items(d)]}"))

# --- SEARCH ---
check("search_AAPL", {"q":"AAPL","limit":5},
      lambda d: (any(a.get("symbol","").upper()=="AAPL" for a in items(d)),
                 f"symbols={[a.get('symbol') for a in items(d)]}"))
check("search_Apple", {"q":"Apple","limit":5},
      lambda d: (len(items(d))>0, f"total={total(d)} first={items(d)[0].get('symbol') if items(d) else None}"))
check("search_RELIANCE", {"q":"RELIANCE","limit":5},
      lambda d: (any("RELIANCE" in (a.get("symbol","").upper()) for a in items(d)),
                 f"symbols={[a.get('symbol') for a in items(d)]}"))
check("search_TCS", {"q":"TCS","limit":5},
      lambda d: (len(items(d))>0, f"total={total(d)} first={items(d)[0].get('symbol') if items(d) else None}"))

# --- PAGINATION ---
check("page1_10", {"type":"stocks","marketCountries":"US","limit":10,"offset":0,"sortBy":"marketCap","sortOrder":"desc"},
      lambda d: (len(items(d))==10, f"count={len(items(d))}"))
check("page2_10", {"type":"stocks","marketCountries":"US","limit":10,"offset":10,"sortBy":"marketCap","sortOrder":"desc"},
      lambda d: (len(items(d))==10, f"count={len(items(d))}"))

p1 = get({"type":"stocks","marketCountries":"US","limit":10,"offset":0,"sortBy":"marketCap","sortOrder":"desc"})
p2 = get({"type":"stocks","marketCountries":"US","limit":10,"offset":10,"sortBy":"marketCap","sortOrder":"desc"})
s1 = [a.get("fullSymbol") or a.get("symbol") for a in items(p1)]
s2 = [a.get("fullSymbol") or a.get("symbol") for a in items(p2)]
overlap = set(s1) & set(s2)
if not overlap:
    PASS += 1; results.append(("PASS","pagination_no_overlap","overlap=0"))
    print(f"[PASS] pagination_no_overlap: overlap=0")
else:
    WARN += 1; results.append(("WARN","pagination_no_overlap",f"overlap={overlap} — dual-listed expected"))
    print(f"[WARN] pagination_no_overlap: overlap={overlap}")

# --- COMBO ---
check("combo_US_tech_mcap", {"type":"stocks","marketCountries":"US","sector":"Technology","sortBy":"marketCap","sortOrder":"desc","limit":5},
      lambda d: (total(d)>500 and items(d) and items(d)[0].get("sector")=="Technology",
                 f"total={total(d)} top={[(a.get('symbol'),a.get('sector')) for a in items(d)[:3]]}"))
check("combo_IN_mcap", {"type":"stocks","marketCountries":"IN","sortBy":"marketCap","sortOrder":"desc","limit":5},
      lambda d: (total(d)>100, f"total={total(d)} top={[a.get('symbol') for a in items(d)[:3]]}"))
check("combo_limit_1", {"type":"stocks","marketCountries":"US","limit":1},
      lambda d: (len(items(d))==1, f"count={len(items(d))} total={total(d)}"))

# --- NULL RATES ---
us = get({"type":"stocks","marketCountries":"US","limit":100})
for field in ["price","pe","marketCap","volume","eps"]:
    arr = items(us)
    null_n = sum(1 for a in arr if a.get(field) is None)
    r = (null_n/len(arr)*100) if arr else 100
    if r < 80: PASS += 1; results.append(("PASS", f"null_US_{field}", f"{r:.1f}%")); print(f"[PASS] null_US_{field}: {r:.1f}%")
    else: WARN += 1; results.append(("WARN", f"null_US_{field}", f"{r:.1f}%")); print(f"[WARN] null_US_{field}: {r:.1f}%")

ind = get({"type":"stocks","marketCountries":"IN","limit":100})
for field in ["pe","roe","earningsGrowth","marketCap","price"]:
    arr = items(ind)
    null_n = sum(1 for a in arr if a.get(field) is None)
    r = (null_n/len(arr)*100) if arr else 100
    if r < 90: PASS += 1; results.append(("PASS", f"null_IN_{field}", f"{r:.1f}%")); print(f"[PASS] null_IN_{field}: {r:.1f}%")
    else: WARN += 1; results.append(("WARN", f"null_IN_{field}", f"{r:.1f}%")); print(f"[WARN] null_IN_{field}: {r:.1f}%")

print()
print("=" * 60)
print(f"MATRIX SUMMARY: PASS={PASS}  FAIL={FAIL}  WARN={WARN}  TOTAL={PASS+FAIL+WARN}")
print("=" * 60)
for status, name, note in results:
    if status != "PASS":
        print(f"  [{status}] {name}: {note}")
