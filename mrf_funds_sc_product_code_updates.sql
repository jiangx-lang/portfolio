-- 第三步：在 Supabase SQL Editor 执行以下语句，为每只 MRF 基金填入 sc_product_code
-- 当前 top_holdings_detail.csv 中仅有 QDII 基金（QDUR/QDUT），无 968 香港 MRF 基金。
-- 若你已有 968 代码与 MRF 名称的对应关系，请替换下方占位码（968001～968016）。
-- 若希望点击某只 MRF 时展示某只 QDII 的持仓（演示用），可把该 MRF 的 sc_product_code 设为该 QDII 的 code（如 QDUR104USD）。

ALTER TABLE mrf_funds ADD COLUMN IF NOT EXISTS sc_product_code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS mrf_funds_code_idx ON mrf_funds(sc_product_code)
  WHERE sc_product_code IS NOT NULL;

-- 以下为 16 只 MRF 基金占位码，请按实际 968 或 QDII 代码修改后执行：
UPDATE mrf_funds SET sc_product_code = '968001' WHERE fund_name = '东方汇理香港组合-灵活配置增长';
UPDATE mrf_funds SET sc_product_code = '968002' WHERE fund_name = '东方汇理香港组合-灵活配置均衡';
UPDATE mrf_funds SET sc_product_code = '968003' WHERE fund_name = '东方汇理香港组合-灵活配置平稳';
UPDATE mrf_funds SET sc_product_code = '968004' WHERE fund_name = '东亚联丰环球股票基金';
UPDATE mrf_funds SET sc_product_code = '968005' WHERE fund_name = '东亚联丰亚洲债券及货币基金';
UPDATE mrf_funds SET sc_product_code = '968006' WHERE fund_name = '惠理高息股票基金';
UPDATE mrf_funds SET sc_product_code = '968007' WHERE fund_name = '惠理价值基金';
UPDATE mrf_funds SET sc_product_code = '968050' WHERE fund_name = '摩根国际债';
UPDATE mrf_funds SET sc_product_code = '968009' WHERE fund_name = '摩根太平洋科技';
UPDATE mrf_funds SET sc_product_code = '968010' WHERE fund_name = '摩根太平洋证券';
UPDATE mrf_funds SET sc_product_code = '968011' WHERE fund_name = '摩根亚洲股息';
UPDATE mrf_funds SET sc_product_code = '968000' WHERE fund_name = '摩根亚洲总收益';
UPDATE mrf_funds SET sc_product_code = '968013' WHERE fund_name = '瑞士百达策略收益基金';
-- 中银：与 scripts/mrf_akshare_mapping.csv 一致（上交所 968 代码）；若你渠道为 968014/968015 请改 holdings 与 funds 同步
UPDATE mrf_funds SET sc_product_code = '968031' WHERE fund_name = '中银香港环球股票基金';
UPDATE mrf_funds SET sc_product_code = '968030' WHERE fund_name = '中银香港香港股票基金';
UPDATE mrf_funds SET sc_product_code = '968013' WHERE fund_name = '施罗德亚洲高息股债基金M类别(人民币派息)';
