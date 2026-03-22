import { NextResponse } from "next/server";
import fs from "fs";

export const dynamic = "force-dynamic";

/** 与 Nginx `location /risk-figures/`、`/risk-figures-root/` 对应的公网域名 */
const RISK_MEDIA_BASE =
  process.env.RISK_MEDIA_BASE_URL?.replace(/\/$/, "") ||
  "https://media.atlasallocations.com";

export async function GET() {
  const reportPath =
    "/root/fredmonitor/outputs/crisis_monitor/crisis_report_latest.html";
  try {
    let content = fs.readFileSync(reportPath, "utf-8");

    const figPrefix = `${RISK_MEDIA_BASE}/risk-figures/`;
    const rootPrefix = `${RISK_MEDIA_BASE}/risk-figures-root/`;

    // 双引号：figures/ 与 ./figures/
    content = content.replace(/src="(?:\.\/)?figures\//g, `src="${figPrefix}`);
    // 单引号
    content = content.replace(/src='(?:\.\/)?figures\//g, `src='${figPrefix}`);

    // 根目录下的 *_latest.png（双引号 / 单引号），不局限于大写字母
    content = content.replace(
      /src="([\w]+_latest\.png)"/g,
      `src="${rootPrefix}$1"`
    );
    content = content.replace(
      /src='([\w]+_latest\.png)'/g,
      `src='${rootPrefix}$1'`
    );

    return new NextResponse(content, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
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
