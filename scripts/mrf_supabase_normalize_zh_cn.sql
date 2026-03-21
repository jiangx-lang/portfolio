-- =============================================================================
-- MRF 表繁体 → 简体统一（在 Supabase SQL Editor 执行，建议先备份）
-- 作用：mrf_holdings / mrf_funds 中基金名、持仓名与项目 mrf_funds 种子一致，
--       避免「简体基金列表 + 繁体持仓表 fund_name」对不上导致查无数据。
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) mrf_holdings：基金维度 fund_name（与 sc_product_code 列无关，先改名称）
-- ---------------------------------------------------------------------------
UPDATE mrf_holdings
SET fund_name = '中银香港环球股票基金'
WHERE fund_name = '中銀香港環球股票基金';

UPDATE mrf_holdings
SET fund_name = '中银香港香港股票基金'
WHERE fund_name = '中銀香港香港股票基金';

-- ---------------------------------------------------------------------------
-- 2) mrf_holdings：底层证券名称 holding_name（与 Top10 CSV / 港股披露一致改为简体）
-- ---------------------------------------------------------------------------
UPDATE mrf_holdings SET holding_name = 'VANGUARD S&P 500 ETF 8.6% 能源相关'
WHERE holding_name = 'VANGUARD S&P 500 ETF 8.6% 能源相關';

UPDATE mrf_holdings SET holding_name = 'ISHARES MSCI EMERGING MARKETS ASIA ETF 4.9% 通讯服务'
WHERE holding_name = 'ISHARES MSCI EMERGING MARKETS ASIA ETF 4.9% 通訊服務';

UPDATE mrf_holdings SET holding_name = '中银保诚日本中小企业机遇基金'
WHERE holding_name = '中銀保誠日本中小企業機遇基金';

UPDATE mrf_holdings SET holding_name = '汇丰控股有限公司 9.0% 通讯服务'
WHERE holding_name = '滙豐控股有限公司 9.0% 通訊服務';

UPDATE mrf_holdings SET holding_name = '腾讯控股有限公司'
WHERE holding_name = '騰訊控股有限公司';

UPDATE mrf_holdings SET holding_name = '阿里巴巴集团控股有限公司'
WHERE holding_name = '阿里巴巴集團控股有限公司';

UPDATE mrf_holdings SET holding_name = '友邦保险控股有限公司'
WHERE holding_name = '友邦保險控股有限公司';

UPDATE mrf_holdings SET holding_name = '中国建设银行股份有限公司－H'
WHERE holding_name = '中國建設銀行股份有限公司－H';

UPDATE mrf_holdings SET holding_name = '小米集团－B类别'
WHERE holding_name = '小米集團－B類別';

UPDATE mrf_holdings SET holding_name = '美团－B类别'
WHERE holding_name = '美團－B類別';

UPDATE mrf_holdings SET holding_name = '中国工商银行股份有限公司－H'
WHERE holding_name = '中國工商銀行股份有限公司－H';

UPDATE mrf_holdings SET holding_name = '中国移动有限公司－H'
WHERE holding_name = '中國移動有限公司－H';

UPDATE mrf_holdings SET holding_name = '香港交易及结算所有限公司'
WHERE holding_name = '香港交易及結算所有限公司';

-- ---------------------------------------------------------------------------
-- 3) mrf_funds：主键为 fund_name，仅当库内为繁体时更新为简体
-- ---------------------------------------------------------------------------
UPDATE mrf_funds
SET fund_name = '中银香港环球股票基金'
WHERE fund_name = '中銀香港環球股票基金';

UPDATE mrf_funds
SET fund_name = '中银香港香港股票基金'
WHERE fund_name = '中銀香港香港股票基金';

COMMIT;

-- ---------------------------------------------------------------------------
-- 4) 验证
-- ---------------------------------------------------------------------------
-- SELECT fund_name, sc_product_code, COUNT(*) FROM mrf_holdings
--   WHERE fund_name LIKE '%中银香港%' OR fund_name LIKE '%中銀%'
--   GROUP BY 1, 2;
