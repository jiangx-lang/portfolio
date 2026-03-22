import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase";

const ADMIN_PASSWORD =
  process.env.NEXT_PUBLIC_ADMIN_PASSWORD?.trim() || "atlas2024";

export async function GET(req: NextRequest) {
  // nextUrl.searchParams.get 已自动解码百分号编码（与 encodeURIComponent 配对）
  const pwd = req.nextUrl.searchParams.get("pwd") ?? "";
  if (!pwd || pwd !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const supabase = getSupabaseServiceRole();
  if (!supabase) {
    return NextResponse.json(
      {
        error: "未配置 SUPABASE_SERVICE_ROLE_KEY（或 URL），无法读取 visitor_logs",
        logs: [],
      },
      { status: 200 }
    );
  }

  const { data, error } = await supabase
    .from("visitor_logs")
    .select("id,page,ip,country,city,user_agent,referer,visited_at")
    .order("visited_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message, logs: [] }, { status: 500 });
  }

  return NextResponse.json({ logs: data ?? [] });
}
