import { NextRequest, NextResponse } from "next/server";
import path from "path";
import maxmind, { type CityResponse } from "maxmind";

export const dynamic = "force-dynamic";

const DB_PATH =
  process.env.MAXMIND_DB_PATH?.trim() ||
  path.join(process.cwd(), "data", "GeoLite2-City.mmdb");

let readerPromise: Promise<maxmind.Reader<CityResponse>> | null = null;

async function getReader() {
  if (!readerPromise) {
    readerPromise = maxmind.open<CityResponse>(DB_PATH);
  }
  return readerPromise;
}

function pickName(
  names: Record<string, string> | undefined,
  preferredLocales: string[]
): string | null {
  if (!names) return null;
  for (const loc of preferredLocales) {
    const v = names[loc];
    if (v && v.trim()) return v.trim();
  }
  // fallback: any value
  const any = Object.values(names).find((v) => v && v.trim());
  return any ? any.trim() : null;
}

export async function GET(req: NextRequest) {
  const ip = (req.nextUrl.searchParams.get("ip") || "").trim();
  if (!ip) {
    return NextResponse.json({ city: null, country: null, region: null }, { status: 200 });
  }

  try {
    const reader = await getReader();
    const res = reader.get(ip);
    if (!res) {
      return NextResponse.json({ city: null, country: null, region: null }, { status: 200 });
    }

    const iso = (res.country?.iso_code || "").toUpperCase();

    const isCN = iso === "CN";
    const city = isCN
      ? pickName(res.city?.names, ["zh-CN", "zh", "en"])
      : pickName(res.city?.names, ["en", "zh-CN", "zh"]);

    const region = isCN
      ? pickName(res.subdivisions?.[0]?.names, ["zh-CN", "zh", "en"])
      : pickName(res.subdivisions?.[0]?.names, ["en", "zh-CN", "zh"]);

    const country = isCN
      ? pickName(res.country?.names, ["zh-CN", "zh", "en"]) || "中国"
      : pickName(res.country?.names, ["en", "zh-CN", "zh"]) || iso || null;

    // 展示层偏好：
    // - 中国：优先 city，其次 region，其次 中国
    // - 非中国：用 "City, Country"（英语）或 "Country"
    const displayCity = city || null;
    const displayRegion = region || null;

    return NextResponse.json(
      {
        city: displayCity,
        region: displayRegion,
        country,
      },
      { status: 200 }
    );
  } catch {
    // mmdb 不存在/损坏/IP 无法解析等：静默失败
    return NextResponse.json({ city: null, country: null, region: null }, { status: 200 });
  }
}

