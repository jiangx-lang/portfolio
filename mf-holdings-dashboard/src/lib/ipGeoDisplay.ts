/** ip-api.com JSON（fields=status,message,country,countryCode,regionName,city,org） */

export type IpApiFields = {
  status: "success" | "fail";
  message?: string;
  country?: string;
  countryCode?: string;
  regionName?: string;
  city?: string;
  org?: string;
};

/** 跳过 ip-api 查询：本地/内网/环回 */
export function isPrivateOrLocalIp(ip: string): boolean {
  const t = ip.trim();
  if (!t) return true;
  if (t === "::1" || t === "127.0.0.1" || t === "0.0.0.0") return true;
  if (t.startsWith("10.")) return true;
  if (t.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(t)) return true;
  if (/^fe80:/i.test(t)) return true;
  if (/^::ffff:127\./i.test(t)) return true;
  return false;
}

const CLOUD_ORG_RE = /Amazon|Google|Microsoft|Alibaba|Tencent/i;

export function countryCodeToFlag(code: string | undefined): string {
  if (!code || code.length !== 2) return "🌐";
  const A = 0x1f1e6;
  const up = code.toUpperCase();
  let out = "";
  for (let i = 0; i < 2; i++) {
    const c = up.charCodeAt(i);
    if (c < 65 || c > 90) return "🌐";
    out += String.fromCodePoint(A + (c - 65));
  }
  return out;
}

/** 运营商/备注：org + 云厂商标注 */
export function formatOrgNote(org: string | undefined | null): string {
  const o = (org || "").trim();
  if (!o) return "—";
  if (CLOUD_ORG_RE.test(o)) return `${o} (云服务器)`;
  return o;
}

/**
 * 归属地一行（不含 IP）；美国单独「美国」，org 放在运营商列。
 */
export function formatLocationLine(j: IpApiFields): string {
  if (j.status !== "success") {
    return j.message ? `— (${j.message})` : "—";
  }
  const code = (j.countryCode || "").toUpperCase();
  const flag = countryCodeToFlag(code);
  const region = (j.regionName || "").trim();
  const city = (j.city || "").trim();

  if (code === "HK") return `${flag} 香港`;
  if (code === "MO") return `${flag} 澳门`;
  if (code === "CN") {
    const place = `${region}${city}`.replace(/\s+/g, "") || j.country || "中国";
    return `${flag} ${place}`;
  }
  if (code === "US") {
    return `${flag} 美国`;
  }
  const country = (j.country || code || "未知").trim();
  return `${flag} ${country}`;
}
