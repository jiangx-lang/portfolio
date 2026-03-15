"""演示：销售搜索 - AI Hardware / AI Software / HALO / Semiconductor / Cloud / Cybersecurity。"""
from fund_tagging.search import FundSearchEngine

db = "fund_tagging.db"
e = FundSearchEngine(db_path=db)

queries = [
    ("theme = AI Hardware", {"themes": ["AI Hardware"]}),
    ("theme = AI Software", {"themes": ["AI Software"]}),
    ("theme = HALO", {"themes": ["HALO"]}),
    ("theme = Semiconductor", {"themes": ["Semiconductor"]}),
    ("theme = Cloud", {"themes": ["Cloud"]}),
    ("theme = Cybersecurity", {"themes": ["Cybersecurity"]}),
    ("theme = China Internet", {"themes": ["China Internet"]}),
    ("theme = Datacenter", {"themes": ["Datacenter"]}),
    ("theme = AI（含子标签）", {"themes": ["AI"]}),
]
for label, criteria in queries:
    print(f"=== {label} ===")
    for r in e.search(criteria, limit=3):
        tags = [m["tag_name"] for m in r["matches"]]
        print(f"  fund_id={r['fund_id']} score={r['combined_score']:.2f}%  {tags}")
    print()

e.close()
print("Done.")
