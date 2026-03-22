-- 可选：为 QD 页「亚洲债」筛选增加 theme 标签（执行后请在 mf-holdings-dashboard/src/data/qdiiFundFilterConfig.ts
-- 将 QD_BOND_TAG_GROUPS.亚洲债 改为 ('AsiaBond')，并为相关基金写入 fund_tag_map）
INSERT INTO tag_taxonomy (tag_id, tag_name, category, aliases, is_active, created_at)
SELECT (SELECT IFNULL(MAX(tag_id), 0) + 1 FROM tag_taxonomy), 'AsiaBond', 'theme', '[]', 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE NOT EXISTS (SELECT 1 FROM tag_taxonomy WHERE tag_name = 'AsiaBond');
