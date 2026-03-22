import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSupabaseServiceRole } from "@/lib/supabase";

function clientIp(h: Headers): string {
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first.slice(0, 128);
  }
  return (h.get("x-real-ip") || h.get("cf-connecting-ip") || "").slice(0, 128);
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseServiceRole();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "服务端未配置 SUPABASE_SERVICE_ROLE_KEY 或 SUPABASE_URL" },
      { status: 503 }
    );
  }

  let page = "/";
  try {
    const body = (await req.json()) as { page?: unknown };
    if (typeof body.page === "string" && body.page.trim()) {
      const p = body.page.trim().slice(0, 512);
      page = p.startsWith("/") ? p : `/${p}`;
    }
  } catch {
    return NextResponse.json({ ok: false, error: "无效 JSON" }, { status: 400 });
  }

  const h = headers();
  const ip = clientIp(h) || null;
  const user_agent = (h.get("user-agent") || "").slice(0, 512) || null;
  const referer = (h.get("referer") || h.get("referrer") || "").slice(0, 512) || null;

  const { error } = await supabase.from("visitor_logs").insert({
    page,
    ip,
    user_agent,
    referer,
    country: null,
    city: null,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
