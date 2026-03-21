import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** 持仓表 fund_name 常为繁体，mrf_funds 常为简体，按代码查 holdings 时需同时试这些名称 */
/** 库内 fund_name 已全部规范为简体后，此处仅保留主名称；仍兼容旧库繁体一行兜底 */
const SC_CODE_HOLDING_FUND_NAME_ALIASES: Record<string, string[]> = {
  "968031": ["中银香港环球股票基金", "中銀香港環球股票基金"],
  "968030": ["中银香港香港股票基金", "中銀香港香港股票基金"],
};

/** 全角数字 → ASCII；去掉零宽/BOM，避免页面传入的 code 与库内 968031 不一致 */
function toAsciiDigits(s: string): string {
  return s
    .replace(/^\uFEFF/, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\uFF10-\uFF19]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30));
}

/** 从字符串中提取 968 产品码（用于简繁别名分支与查询） */
function extract968ProductCode(s: string): string | null {
  const ascii = toAsciiDigits(s.trim());
  const m = ascii.match(/968\d{2,}/);
  return m ? m[0] : null;
}

/** PostgREST 对 text/int 列混用筛选时，多给几种字面量更稳 */
function scCodeVariants(code: string): (string | number)[] {
  const t = toAsciiDigits(code).trim();
  const out = new Set<string | number>([t, t.replace(/\s+/g, "")]);
  if (/^\d+$/.test(t)) {
    const n = Number(t);
    out.add(String(n));
    out.add(n);
  }
  return Array.from(out);
}

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
    const decodedRaw = decodeURIComponent(code).trim();
    if (!decodedRaw) {
      return NextResponse.json({ holdings: [], message: "Missing code" });
    }
    const decoded968 = extract968ProductCode(decodedRaw);
    /** 查询用：能解析出 968 码则用规范码，否则保留原文（基金中文名等） */
    const decoded = decoded968 ?? toAsciiDigits(decodedRaw).trim();

    // MRF：968 开头 或 非 QDUR/QDUT（如基金中文名）→ 查 Supabase mrf_holdings
    const isMRF =
      /^968\d+$/i.test(decoded) ||
      (!decoded.startsWith("QDUR") && !decoded.startsWith("QDUT"));

    if (isMRF) {
      const supabase = getSupabase();
      if (!supabase) {
        return NextResponse.json({
          holdings: [],
          fund: decoded,
          code: decoded,
          message: "SUPABASE_NOT_CONFIGURED",
          source: "none",
        });
      }
      // 先按 sc_product_code（多格式）查 → 再按 fund_name（URL 为中文名）→ 再按 mrf_funds+别名（简繁不一致）
      type HRow = {
        rank: number;
        holding_name: string;
        holding_type: string;
        weight_pct: number;
        as_of_date: string;
        fund_name: string;
      };
      let data: HRow[] | null = null;

      const codeVars = scCodeVariants(decoded);
      let byCodeIn: HRow[] | null = null;
      const qHoldings = () =>
        supabase
          .from("mrf_holdings")
          .select("rank, holding_name, holding_type, weight_pct, as_of_date, fund_name")
          .order("rank", { ascending: true })
          .limit(15);

      const { data: byCodeMixed, error: errMixed } = await qHoldings().in("sc_product_code", codeVars);
      if (errMixed) {
        console.warn("[mrf/holdings] in(sc_product_code) mixed:", errMixed.message);
      }
      if (byCodeMixed && byCodeMixed.length > 0) {
        byCodeIn = byCodeMixed;
      } else {
        const strOnly = codeVars.filter((v): v is string => typeof v === "string");
        if (strOnly.length > 0) {
          const { data: byCodeStr, error: errStr } = await qHoldings().in("sc_product_code", strOnly);
          if (errStr) console.warn("[mrf/holdings] in(sc_product_code) str:", errStr.message);
          if (byCodeStr && byCodeStr.length > 0) byCodeIn = byCodeStr;
        }
      }

      if (byCodeIn && byCodeIn.length > 0) {
        data = byCodeIn;
      } else {
        const { data: byName } = await supabase
          .from("mrf_holdings")
          .select("rank, holding_name, holding_type, weight_pct, as_of_date, fund_name")
          .eq("fund_name", decodedRaw)
          .order("rank", { ascending: true })
          .limit(15);
        if (byName && byName.length > 0) data = byName;
      }

      // 仍无数据：用 mrf_funds 反查基金全称 + 已知简繁别名，一次 in(fund_name)
      const aliasKey = decoded968 ?? (/^968\d+$/i.test(decoded) ? decoded : null);
      if (!data?.length && aliasKey && /^968\d+$/i.test(aliasKey)) {
        const nameCandidates = new Set<string>();
        for (const v of scCodeVariants(aliasKey)) {
          const { data: fundRows } = await supabase
            .from("mrf_funds")
            .select("fund_name")
            .eq("sc_product_code", v);
          fundRows?.forEach((r) => {
            if (r.fund_name) nameCandidates.add(String(r.fund_name).trim());
          });
        }
        const aliases =
          SC_CODE_HOLDING_FUND_NAME_ALIASES[aliasKey] ??
          SC_CODE_HOLDING_FUND_NAME_ALIASES[String(Number(aliasKey))] ??
          [];
        aliases.forEach((a) => nameCandidates.add(a));

        const names = Array.from(nameCandidates).filter(Boolean);
        if (names.length > 0) {
          const { data: byNames } = await supabase
            .from("mrf_holdings")
            .select("rank, holding_name, holding_type, weight_pct, as_of_date, fund_name")
            .in("fund_name", names)
            .order("rank", { ascending: true })
            .limit(15);
          if (byNames && byNames.length > 0) data = byNames;
        }
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
      // MRF 但无匹配行：不 fallback 到 QD
      return NextResponse.json({
        holdings: [],
        fund: decoded,
        code: decoded,
        message: "NO_MRF_HOLDINGS_ROWS",
        source: "supabase",
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
