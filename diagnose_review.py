import sqlite3, json
conn = sqlite3.connect("./sc_funds.db")

rows = conn.execute("""
    SELECT f.id, f.fund_name_cn, f.source_file,
           pl.uncertain_fields, pl.null_key_fields,
           pl.validation_errors, pl.status as log_status
    FROM funds f
    JOIN (
        SELECT source_file, uncertain_fields, null_key_fields,
               validation_errors, status,
               ROW_NUMBER() OVER (PARTITION BY source_file ORDER BY id DESC) rn
        FROM parsing_logs
    ) pl ON pl.source_file = f.source_file AND pl.rn = 1
    WHERE f.status = 1
      AND (
        pl.status IN ('partial','failed')
        OR (pl.null_key_fields IS NOT NULL AND pl.null_key_fields != '[]')
        OR (pl.uncertain_fields IS NOT NULL AND pl.uncertain_fields != '[]')
        OR (pl.validation_errors IS NOT NULL AND pl.validation_errors != '[]')
      )
    ORDER BY f.id
""").fetchall()

print(f"找到 {len(rows)} 条「应为待审核」的记录：\n")
for r in rows:
    nulls = json.loads(r[4] or '[]')   # null_key_fields
    unc   = json.loads(r[3] or '[]')   # uncertain_fields
    errs  = json.loads(r[5] or '[]')   # validation_errors
    problems = []
    if nulls: problems.append(f"null:{','.join(nulls)}")
    if unc:
        if isinstance(unc, list) and unc and isinstance(unc[0], dict):
            problems.append(f"不确定:{','.join(u.get('field','?') for u in unc)}")
        else:
            problems.append(f"不确定:{str(unc)[:80]}")
    if errs:
        err_str = ';'.join(errs[:2]) if isinstance(errs, list) else str(errs)[:80]
        problems.append(f"校验:{err_str}")
    name = (r[1] or r[2] or '')[:40]
    print(f"  ID{r[0]:>4}  {name:<40}  {' | '.join(problems)}")

conn.close()
