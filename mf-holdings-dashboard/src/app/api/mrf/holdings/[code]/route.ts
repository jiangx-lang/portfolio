import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type HoldingRow = {
  rank: number;
  holding_name_std: string;
  holding_name_raw: string | null;
  holding_type: string;
  weight_pct: number;
  as_of_date: string;
  fund_name_cn?: string | null;
  sc_product_code?: string | null;
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const decoded = decodeURIComponent(code).trim();
    if (!decoded) {
      return NextResponse.json({ holdings: [], message: "Missing code" });
    }

    // MRF：968 开头 或 非 QDUR/QDUT（如基金中文名）→ 查 Supabase mrf_holdings
    const isMRF =
      /^968\d+$/i.test(decoded) ||
      (!decoded.startsWith("QDUR") && !decoded.startsWith("QDUT"));

    if (isMRF) {
      const supabase = getSupabase();
      if (supabase) {
        // 先按 sc_product_code 查，再按 fund_name 查（兼容 MRF 页传基金名）
        let data: { rank: number; holding_name: string; holding_type: string; weight_pct: number; as_of_date: string; fund_name: string }[] | null = null;

        const { data: byCode } = await supabase
          .from("mrf_holdings")
          .select("rank, holding_name, holding_type, weight_pct, as_of_date, fund_name")
          .eq("sc_product_code", decoded)
          .order("rank", { ascending: true })
          .limit(15);

        if (byCode && byCode.length > 0) {
          data = byCode;
        } else {
          const { data: byName } = await supabase
            .from("mrf_holdings")
            .select("rank, holding_name, holding_type, weight_pct, as_of_date, fund_name")
            .eq("fund_name", decoded)
            .order("rank", { ascending: true })
            .limit(15);
          if (byName && byName.length > 0) data = byName;
        }

        if (data && data.length > 0) {
          const holdings: HoldingRow[] = data.map((r) => ({
            rank: r.rank ?? 0,
            holding_name_std: r.holding_name ?? "",
            holding_name_raw: r.holding_name ?? null,
            holding_type: r.holding_type ?? "equity",
            weight_pct: Number(r.weight_pct ?? 0),
            as_of_date: r.as_of_date ? String(r.as_of_date).slice(0, 10) : "",
            fund_name_cn: r.fund_name ?? null,
          }));
          return NextResponse.json({
            holdings,
            fund: data[0]?.fund_name ?? decoded,
            code: decoded,
            source: "supabase",
          });
        }
      }
      // MRF 但 Supabase 无数据或未配置：不 fallback 到 QD，直接返回空
      return NextResponse.json({
        holdings: [],
        fund: decoded,
        code: decoded,
        message: "No MRF holdings data",
      });
    }

    // QD：QDUR / QDUT 开头 → 查 SQLite fund_holding_exposure
    const dbPath = path.join(process.cwd(), "..", "qdii_portfolio", "fund_tagging.db");
    const db = new Database(dbPath, { readonly: true });

    const rows = db
      .prepare(
        `
      SELECT rank, holding_name_std, holding_name_raw,
             holding_type, weight_pct, as_of_date, fund_name_cn,
             sc_product_code
      FROM fund_holding_exposure
      WHERE sc_product_code = ?
         OR sc_product_code LIKE ?
         OR primary_code = ?
      ORDER BY CAST(rank AS INTEGER) ASC
      LIMIT 10
    `
      )
      .all(decoded, `${decoded}%`, decoded) as HoldingRow[];

    db.close();

    if (!rows || rows.length === 0) {
      return NextResponse.json({ holdings: [], fund: decoded, code: decoded, message: "No holdings data" });
    }

    return NextResponse.json({
      holdings: rows,
      fund: rows[0]?.fund_name_cn ?? decoded,
      code: decoded,
      source: "sqlite",
    });
  } catch (err) {
    console.error("Holdings API error:", err);
    return NextResponse.json({ holdings: [], error: String(err) });
  }
}
