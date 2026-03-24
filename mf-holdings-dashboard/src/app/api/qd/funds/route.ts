import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";
import { fetchFundPerformanceBulk, lookupFundPerformance } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const dbPath = path.join(process.cwd(), "..", "qdii_portfolio", "fund_tagging.db");
    const db = new Database(dbPath, { readonly: true });

    const allTags = db
      .prepare(
        `
        SELECT DISTINCT tt.tag_name, tt.category
        FROM tag_taxonomy tt
        WHERE tt.is_active = 1
        ORDER BY tt.category, tt.tag_name
      `
      )
      .all() as { tag_name: string; category: string | null }[];

    // 每个 category 取 aggregated_score 最高的 1 个标签（避免全局 Top 3 挤掉地域等维度）
    const tagRows = db
      .prepare(
        `
        SELECT
          ftm.fund_id AS fund_id,
          tt.tag_name AS tag_name,
          tt.category AS category,
          ftm.aggregated_score AS aggregated_score
        FROM fund_tag_map ftm
        JOIN tag_taxonomy tt ON tt.tag_id = ftm.tag_id
        WHERE tt.is_active = 1
        ORDER BY ftm.fund_id, tt.category, ftm.aggregated_score DESC
      `
      )
      .all() as {
        fund_id: number;
        tag_name: string;
        category: string | null;
        aggregated_score: number;
      }[];

    const tagsByCat: Record<number, Record<string, string>> = {};
    for (const r of tagRows) {
      if (!tagsByCat[r.fund_id]) tagsByCat[r.fund_id] = {};
      const cat = r.category || "theme";
      if (!tagsByCat[r.fund_id][cat]) {
        tagsByCat[r.fund_id][cat] = String(r.tag_name);
      }
    }

    const tagsMap: Record<number, string[]> = {};
    for (const [fid, catMap] of Object.entries(tagsByCat)) {
      tagsMap[Number(fid)] = Object.values(catMap);
    }

    const funds = db
      .prepare(
        `
      SELECT
        fund_id,
        fund_name_cn,
        MIN(COALESCE(primary_code, sc_product_code)) AS code,
        MIN(primary_code) AS primary_code,
        MIN(sc_product_code) AS sc_product_code,
        MAX(as_of_date) AS as_of_date,
        COUNT(*) AS holdings_count
      FROM fund_holding_exposure
      WHERE fund_name_cn IS NOT NULL AND (primary_code IS NOT NULL OR sc_product_code IS NOT NULL)
      GROUP BY fund_id, fund_name_cn
      ORDER BY fund_name_cn
    `
      )
      .all() as {
      fund_id: number;
      fund_name_cn: string;
      code: string | null;
      primary_code: string | null;
      sc_product_code: string | null;
      as_of_date: string | null;
      holdings_count: number;
    }[];

    db.close();

    const { byCode: perfByCode, lastUpdated: performanceLastUpdated } = await fetchFundPerformanceBulk();

    const list = funds.map((f) => {
      const primary = f.primary_code || f.code || "";
      const sc = f.sc_product_code || f.code || "";
      const co = f.code || "";
      const performance =
        lookupFundPerformance(perfByCode, primary) ??
        lookupFundPerformance(perfByCode, sc) ??
        lookupFundPerformance(perfByCode, co) ??
        null;
      return {
        fund_id: f.fund_id,
        fund_name_cn: f.fund_name_cn,
        code: f.code || "",
        primary_code: primary,
        sc_product_code: sc,
        as_of_date: f.as_of_date,
        holdings_count: f.holdings_count,
        tags: tagsMap[f.fund_id] || [],
        performance,
      };
    });

    return NextResponse.json({ funds: list, allTags, performanceLastUpdated });
  } catch (err) {
    console.error("QD funds API error:", err);
    return NextResponse.json(
      { funds: [], allTags: [], performanceLastUpdated: null },
      { status: 500 }
    );
  }
}
