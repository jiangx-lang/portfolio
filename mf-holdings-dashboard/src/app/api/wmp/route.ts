import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { computeWmpDisplayFromCsvText } from "@/lib/wmpDisplay";

export const dynamic = "force-dynamic";

const DEFAULT_CSV_PATH = "/root/portfolio/data/wmp_history.csv";

function resolveCsvPath(): string {
  const fromEnv = process.env.WMP_CSV_PATH?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_CSV_PATH;
}

export async function GET() {
  const csvPath = resolveCsvPath();
  try {
    const text = await readFile(csvPath, "utf8");
    const { rows, asOfDate } = computeWmpDisplayFromCsvText(text);
    const latestDate = asOfDate;
    return NextResponse.json({
      rows,
      asOfDate,
      latestDate,
      csvPath,
      error: null as string | null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        rows: [],
        asOfDate: null,
        latestDate: null,
        csvPath,
        error: msg,
      },
      { status: 500 }
    );
  }
}
