-- 在 Supabase SQL Editor 执行，排查「中银香港环球 / 香港股票」无持仓问题
-- 若存在繁体 fund_name，请先执行：scripts/mrf_supabase_normalize_zh_cn.sql
-- 1) 基金主表：是否已填 968 代码（应与 scripts/mrf_akshare_mapping.csv 一致：968031 / 968030）
SELECT fund_name, brand, sc_product_code
FROM mrf_funds
WHERE fund_name LIKE '%中银香港%'
ORDER BY fund_name;

-- 2) 持仓表：是否有行（按基金名或代码任一查；注意 fund_name 可能是繁体「中銀…」）
SELECT fund_name, sc_product_code, COUNT(*) AS n
FROM mrf_holdings
WHERE fund_name LIKE '%中银香港环球%' OR fund_name LIKE '%中銀香港環球%'
   OR fund_name LIKE '%中银香港香港股票%' OR fund_name LIKE '%中銀香港香港股票%'
   OR sc_product_code IN ('968030', '968031', '968014', '968015')
GROUP BY fund_name, sc_product_code;

-- 2b) 一键把代码写对（简繁基金名都覆盖）
-- UPDATE mrf_holdings SET sc_product_code = '968031'
-- WHERE fund_name IN ('中银香港环球股票基金', '中銀香港環球股票基金');
-- UPDATE mrf_holdings SET sc_product_code = '968030'
-- WHERE fund_name IN ('中银香港香港股票基金', '中銀香港香港股票基金');

-- 3) 若上一步 0 行：说明从未导入 — 需将中银 PDF 放入 onepage/ 后运行：
--    py mrf_scan_to_holdings.py --supabase
-- 并确保 mrf_funds.sc_product_code 与 mrf_holdings.sc_product_code 一致（扫描脚本已映射 968030/968031）。
