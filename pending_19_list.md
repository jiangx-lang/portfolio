# 待审核 19 条清单（供人工判断）

**说明**：以下为 status=2 待审记录。判断通过后可执行：
`py sc_fund_audit_tool.py --db ./sc_funds.db --confirm-id <通过的ID逗号分隔> --yes`

完整字段（含 null/uncertain/校验详情）见 **pending_19_for_review.csv**。

---

| 序号 | ID | 基金名称 | 管理人 | 主要问题简述 |
|------|----|----------|--------|--------------|
| 1 | 24 | 霸菱成熟及新兴市场高收益债券基金 | Baring (Ireland) | isin 空；avg_ytm/avg_duration 图中未提供 |
| 2 | 22 | 霸菱韩国联接基金 | Baring (Ireland) | isin 空；nav/avg_ytm/avg_duration/annualized_std_3y 未提供 |
| 3 | 9 | 霸菱香港中国基金 | Baring (Ireland) | isin 空；基准 ret 列与基金列顺序需推断 |
| 4 | 142 | 富达基金 - 新兴「欧非中东」基金 | FIL (Luxembourg) | isin 空；nav/ret_3m/ret_since_inception 未提供 |
| 5 | 20 | 邓普顿环球债券基金 | Franklin Advisers | isin 空；nav 未标明；年度业绩表只到 2013 年，近年 ret 缺失；基准/ AUM 等多项缺失 |
| 6 | 8 | 邓普顿环球总收益基金 | Franklin Advisers | isin/inception_date 空；nav/年化标准差/ytm/duration/持仓/行业配置等未提供 |
| 7 | 134 | 邓普顿环球总收益基金 | Franklin Advisers | **校验**：ret_3m==ret_1y 疑似列错位（美元/欧元） |
| 8 | 5 | 富兰克林互惠欧洲基金 | Franklin Mutual | isin 空；nav/成立至今回报/前十大持仓未提供 |
| 9 | 133 | 富兰克林互惠欧洲基金 | Franklin Mutual | **校验**：ret_3m==ret_1y 疑似列错位；ret_2020 缺失 |
| 10 | 82 | 摩根美国科技基金 | Joseph Wilson / Eric Ghernati | **校验**：多份额 ret_3m==ret_1y 疑似列错位；年度表现表缺 2013–2025 |
| 11 | 6 | 邓普顿亚洲增长基金 | Templeton | isin 空；nav/持仓/股息未提供 |
| 12 | 146 | 邓普顿环球债券基金 | 富兰克林邓普顿 | **校验**：ret_3m==ret_1y 疑似列错位；ytm/duration/年化标准差未提供 |
| 13 | 30 | 邓普顿环球总收益基金 | 富兰克林邓普顿 | **校验**：多个份额 ret_3m==ret_1y 疑似列错位；ytm/duration/年化标准差未提供 |
| 14 | 59 | 摩根基金 - 香港基金 | 摩根基金 | isin 空；基准 3 个月回报是否对应需确认 |
| 15 | 52 | 摩根基金 - 美国价值基金 | 摩根资产管理 | **校验**：ret_3m==ret_1y 疑似列错位；nav_currency 未明确（推断 USD） |
| 16 | 61 | 施罗德环球基金系列 - 环球黄金基金 | 施罗德 | **校验**：ret_ytd=192.12 超出合理范围 |
| 17 | 99 | 摩根基金 - 大中华基金 | 由境外产品发行人决定 | **校验**：ret_3m==ret_1y 疑似列错位；ytm/duration/年化标准差未提供 |
| 18 | 7 | 贝莱德全球基金－世界矿业基金 | 贝莱德 | **校验**：ret_ytd=90.59 超出合理范围 |
| 19 | 140 | 贝莱德全球基金－世界黄金基金 | 贝莱德 | **校验**：ret_ytd=156.76 超出合理范围；成立至今回报/基准成立至今未提供 |

---

**校验说明**  
- **ret_3m==ret_1y 疑似列错位**：表格 3 月与 1 年列可能对调，若你确认 PDF 如此或可接受可确认。  
- **ret_ytd 超出合理范围**：年初至今回报数值异常高，需对照 PDF 确认是否真实或应退回重解析。

**你判断后**  
- 全部通过：`--confirm-id 24,22,9,142,20,8,134,5,133,82,6,146,30,59,52,61,99,7,140 --yes`  
- 部分通过：只把通过的 ID 填进 `--confirm-id` 执行即可。  
- 要退回重解析：`--reject-id <ID列表>` 再对对应 PDF 用解析器 `--file ... --force` 重跑。
