import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSupabase } from "@/lib/supabase";

function clientIp(h: Headers): string {
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first.slice(0, 128);
  }
  const real = h.get("x-real-ip") || h.get("cf-connecting-ip");
  return (real || "").slice(0, 128);
}

function sanitizePath(p: unknown): string {
  if (typeof p !== "string" || !p.trim()) return "/";
  const t = p.trim().slice(0, 512);
  return t.startsWith("/") ? t : `/${t}`;
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase 未配置" }, { status: 503 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "无效 JSON" }, { status: 400 });
  }

  const event_type = body.event_type === "content" ? "content" : "page";
  const page_path = sanitizePath(body.page_path);
  let content_type: string | null = null;
  if (typeof body.content_type === "string") {
    const c = body.content_type.slice(0, 64);
    if (["market_note", "podcast", "daily_report"].includes(c)) content_type = c;
  }
  const content_id =
    typeof body.content_id === "number" && Number.isFinite(body.content_id)
      ? Math.floor(body.content_id)
      : null;

  const h = headers();
  const ip = clientIp(h);
  const user_agent = (h.get("user-agent") || "").slice(0, 512);
  const referrer = (h.get("referer") || h.get("referrer") || "").slice(0, 512);

  const { error } = await supabase.from("analytics_events").insert({
    event_type,
    page_path,
    content_type,
    content_id,
    ip: ip || null,
    user_agent: user_agent || null,
    referrer: referrer || null,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
