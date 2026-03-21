# QDII 净值（NAV）数据覆盖说明

## 数据链路

1. **`/qd` 列表**：来自本地 SQLite `qdii_portfolio/fund_tagging.db` → `fund_holding_exposure`（基金名、`primary_code` / `sc_product_code`）。
2. **解析 ISIN**：`/api/fund/[code]` 用 **与 `code` 完全一致** 的字符串查 Supabase **`fund_list`**（`.eq("code", code)`）。
3. **净值序列**：`/api/nav/[isin]?ccy=...&days=...` 查 **`nav_history`**，条件为 **`isin` + `ccy` 同时匹配**。

任一环节缺失都会导致「暂无净值数据」：  
- `fund_list` 里没有该 **产品代码** → 无法得到 ISIN。  
- `nav_history` 里没有该 **ISIN+币种** 的行 → 曲线为空。  
- `fund_list.ccy` 与 `nav_history` 里实际存的 **ccy** 不一致（例如列表是 USD、库里只有 CNY）→ 也会显示无数据。

## 本地诊断脚本

在 `mf-holdings-dashboard` 目录执行（需配置 `.env.local` 中的 `SUPABASE_URL`、`SUPABASE_KEY`）：

```bash
node scripts/check-qd-nav-coverage.cjs
```

会输出：

- ✓ 有 `fund_list` 且 `nav_history` 有数据的基金数量  
- ✗ **`fund_list` 无匹配** 的基金及尝试过的 code  
- ✗ **有 ISIN 但 `nav_history` 为 0 行**（或网络错误）的基金  

完整列表默认写入：  
`mf-holdings-dashboard/scripts/qd-nav-gap-report.json`

## 最近一次样例结果（仅供参考）

在某一环境跑出的数量级（以你本地/服务器实际 JSON 为准）：

| 类别 | 说明 |
|------|------|
| SQLite QD 基金数 | `fund_holding_exposure` 聚合后的只数 |
| fund_list 无匹配 | 多为 **QD 代码未写入 `fund_list`**，或与 SQLite 里 **代码格式不一致**（如 `QDUR128` vs `QDUR128USD`） |
| nav 为 0 | 需在 `nav_history` **按 ISIN+ccy 补数**；若存在其它 ccy，脚本会在报告里提示 `other_ccy_in_nav_history_sample` |

## 修复建议

1. **补 `fund_list`**：对报告里 `tried_codes` 中每一个在 Supabase 不存在的 code，插入对应 `code / isin / ccy`（与披露一致）。  
2. **统一代码口径**：若全站统一用 `QDUR128USD`，SQLite 持仓表或映射层应与之对齐，避免只存 `QDUR128`。  
3. **补 `nav_history`**：对已有 ISIN 的基金跑现有 NAV 同步/导入任务；核对 **ccy** 与 `fund_list` 一致。  
4. **币种不一致**：若 `nav_history` 仅有 `CNY` 而 `fund_list` 为 `USD`，要么改 `fund_list.ccy`，要么在 `nav_history` 增加对应 `ccy` 序列。
