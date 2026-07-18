import { NextRequest, NextResponse } from "next/server";
import type { IpApiFields } from "@/lib/ipGeoDisplay";

export const dynamic = "force-dynamic";

const ADMIN_PASSWORD =
  process.env.NEXT_PUBLIC_ADMIN_PASSWORD?.trim() || "cd123";

/** 免费层为 HTTP；服务端代取避免浏览器 CORS 与混源限制 */
const IP_API_BASE = "http://ip-api.com/json";

export async function GET(req: NextRequest) {
  const pwd = req.nextUrl.searchParams.get("pwd") ?? "";
  if (!pwd || pwd !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const ip = (req.nextUrl.searchParams.get("ip") || "").trim();
  if (!ip) {
    return NextResponse.json({ error: "缺少 ip" }, { status: 400 });
  }

  const fields =
    "status,message,country,countryCode,regionName,city,org,query";
  const url = `${IP_API_BASE}/${encodeURIComponent(ip)}?lang=zh-CN&fields=${fields}`;

  try {
    const res = await fetch(url, { cache: "no-store", next: { revalidate: 0 } });
    if (!res.ok) {
      return NextResponse.json(
        { error: `ip-api HTTP ${res.status}` },
        { status: 502 }
      );
    }
    const j = (await res.json()) as IpApiFields & { query?: string };
    return NextResponse.json(j);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
