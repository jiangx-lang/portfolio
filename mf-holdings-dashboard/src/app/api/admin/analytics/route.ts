import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase";

const ADMIN_PASSWORD =
  process.env.NEXT_PUBLIC_ADMIN_PASSWORD?.trim() || "atlas2024";

function unauthorized() {
  return NextResponse.json({ error: "未授权" }, { status: 401 });
}

export async function GET(req: NextRequest) {
  const pwd = req.headers.get("x-admin-password");
  if (!pwd || pwd !== ADMIN_PASSWORD) return unauthorized();

  const supabase = getSupabaseServiceRole();
  if (!supabase) {
    return NextResponse.json(
      {
        error:
          "未配置 SUPABASE_SERVICE_ROLE_KEY，无法在后台读取统计（写入仍可用 anon）。在 Supabase 控制台 API 页复制 service_role 密钥并加入服务端环境变量。",
        recent: [],
        summary: null,
      },
      { status: 200 }
    );
  }

  const now = Date.now();
  const dayMs = 86_400_000;
  const dayAgo = new Date(now - dayMs).toISOString();
  const weekAgo = new Date(now - 7 * dayMs).toISOString();

  const [recentRes, c24, c7, weekRowsRes] = await Promise.all([
    supabase
      .from("analytics_events")
      .select(
        "id,event_type,page_path,content_type,content_id,ip,user_agent,referrer,created_at"
      )
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("analytics_events")
      .select("*", { count: "exact", head: true })
      .gte("created_at", dayAgo),
    supabase
      .from("analytics_events")
      .select("*", { count: "exact", head: true })
      .gte("created_at", weekAgo),
    supabase
      .from("analytics_events")
      .select("page_path,event_type,content_type,content_id,created_at")
      .gte("created_at", weekAgo)
      .order("created_at", { ascending: false })
      .limit(3000),
  ]);

  if (recentRes.error) {
    return NextResponse.json({ error: recentRes.error.message }, { status: 500 });
  }
  if (weekRowsRes.error) {
    return NextResponse.json({ error: weekRowsRes.error.message }, { status: 500 });
  }

  const recent = recentRes.data ?? [];
  const weekRows = weekRowsRes.data ?? [];

  const byPath: Record<string, number> = {};
  const contentReads: Record<string, number> = {};
  for (const r of weekRows) {
    const path = String(r.page_path || "/");
    byPath[path] = (byPath[path] || 0) + 1;
    if (r.event_type === "content" && r.content_type != null && r.content_id != null) {
      const k = `${r.content_type}:${r.content_id}`;
      contentReads[k] = (contentReads[k] || 0) + 1;
    }
  }

  const byPathSorted = Object.entries(byPath)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30);
  const contentSorted = Object.entries(contentReads)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40);

  return NextResponse.json({
    recent,
    summary: {
      last24h: c24.count ?? 0,
      last7d: c7.count ?? 0,
      byPath: byPathSorted,
      contentReads: contentSorted,
    },
  });
}
