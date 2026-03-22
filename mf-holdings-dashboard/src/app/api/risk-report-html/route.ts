import { NextResponse } from "next/server";
import fs from "fs";

export const dynamic = "force-dynamic";

/**
 * 使用本站绝对路径（由 next.config.js rewrites 转发到 media 子域），
 * 这样 iframe 内文档与图片同属 atlasallocations.com，可绕过常见 img-src 'self' CSP。
 * 若需直连 CDN，可设 RISK_IMG_USE_MEDIA_SUBDOMAIN=1，则仍用 RISK_MEDIA_BASE_URL。
 */
const RISK_MEDIA_BASE =
  process.env.RISK_MEDIA_BASE_URL?.replace(/\/$/, "") ||
  "https://media.atlasallocations.com";
const USE_MEDIA_SUBDOMAIN =
  process.env.RISK_IMG_USE_MEDIA_SUBDOMAIN === "1" ||
  process.env.RISK_IMG_USE_MEDIA_SUBDOMAIN === "true";

function figurePrefixes(): { fig: string; root: string } {
  if (USE_MEDIA_SUBDOMAIN) {
    return {
      fig: `${RISK_MEDIA_BASE}/risk-figures/`,
      root: `${RISK_MEDIA_BASE}/risk-figures-root/`,
    };
  }
  return { fig: "/risk-media/", root: "/risk-media-root/" };
}

/** iframe 内 HTML 单独放宽图片与内联样式，避免网关默认 CSP 挡掉 data: 与外链图 */
const REPORT_CSP = [
  "default-src 'none'",
  "style-src 'unsafe-inline'",
  "img-src 'self' data: blob: https: http:",
  "font-src 'self' data:",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

export async function GET() {
  const reportPath =
    "/root/fredmonitor/outputs/crisis_monitor/crisis_report_latest.html";
  try {
    let content = fs.readFileSync(reportPath, "utf-8");

    const { fig: figPrefix, root: rootPrefix } = figurePrefixes();

    // 双引号：figures/、./figures/、大小写 Figures/
    content = content.replace(
      /src="(?:\.\/)?[Ff]igures\//g,
      `src="${figPrefix}`
    );
    content = content.replace(
      /src='(?:\.\/)?[Ff]igures\//g,
      `src='${figPrefix}`
    );

    // 根目录下的 *_latest.png（双引号 / 单引号）
    content = content.replace(
      /src="([\w]+_latest\.png)"/g,
      `src="${rootPrefix}$1"`
    );
    content = content.replace(
      /src='([\w]+_latest\.png)'/g,
      `src='${rootPrefix}$1'`
    );

    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": REPORT_CSP,
      },
    });
  } catch {
    return new NextResponse(
      '<h1 style="color:white;background:#0a0f1e;padding:40px">报告暂未生成</h1>',
      {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }
}
