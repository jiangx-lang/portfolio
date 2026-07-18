import fs from "fs";
import path from "path";
import type { ChroniclePanel } from "./types";
import { resolveDatasetRel } from "./types";

const UPSTREAM = "https://historyofmarket.com";
const LOCAL_ROOT = path.join(process.cwd(), "public", "chronicle-data");
/** 超过此时长视为过期，优先回源官网（对齐 HoM 日更） */
const STALE_MS = Number(process.env.CHRONICLE_STALE_MS || 26 * 60 * 60 * 1000);

export type ChronicleSyncMeta = {
  synced_at?: string;
  source?: string;
  license?: string;
  attribution?: string;
  ok?: number;
  fail?: number;
  skipped?: number;
  total?: number;
  panel_count?: number | null;
  dataset_count?: number;
  age_hours?: number | null;
  stale?: boolean;
  mode?: "local" | "live" | "mixed";
};

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function readLocalJsonSync(relPath: string): unknown | null {
  const full = path.join(LOCAL_ROOT, relPath);
  if (!fs.existsSync(full)) return null;
  try {
    return JSON.parse(fs.readFileSync(full, "utf8"));
  } catch {
    return null;
  }
}

function localMtimeMs(relPath: string): number | null {
  const full = path.join(LOCAL_ROOT, relPath);
  try {
    return fs.statSync(full).mtimeMs;
  } catch {
    return null;
  }
}

export function getSyncMeta(): ChronicleSyncMeta {
  const raw = readLocalJsonSync("_sync_meta.json") as ChronicleSyncMeta | null;
  const base: ChronicleSyncMeta = raw || {
    source: UPSTREAM,
    license: "CC-BY-4.0",
  };
  const t = base.synced_at ? Date.parse(base.synced_at) : localMtimeMs("_profile.json");
  if (t && Number.isFinite(t)) {
    const age = Date.now() - t;
    base.age_hours = Math.round((age / 3600000) * 10) / 10;
    base.stale = age > STALE_MS;
  } else {
    base.age_hours = null;
    base.stale = true;
  }
  return base;
}

async function fetchUpstream(urlPath: string): Promise<unknown> {
  const url = urlPath.startsWith("http")
    ? urlPath
    : `${UPSTREAM}${urlPath.startsWith("/") ? "" : "/"}${urlPath}`;
  const res = await fetch(url, {
    next: { revalidate: 300 },
    headers: {
      Accept: "application/json",
      "User-Agent": "Atlas-Chronicle/1.1 (+https://atlasallocations.com)",
    },
  });
  if (!res.ok) throw new Error(`Upstream ${res.status}: ${url}`);
  return res.json();
}

function isLocalFresh(relPath: string): boolean {
  const preferLive = process.env.CHRONICLE_PREFER_LIVE === "1";
  if (preferLive) return false;
  const mt = localMtimeMs(relPath) ?? localMtimeMs("_sync_meta.json");
  if (!mt) return false;
  return Date.now() - mt <= STALE_MS;
}

/** Prefer fresh local mirror; otherwise live historyofmarket.com */
export async function loadChronicleJson(relOrApiPath: string): Promise<unknown> {
  const rel = relOrApiPath.replace(/^\/api\//, "").replace(/^\//, "");
  if (isLocalFresh(rel) || isLocalFresh("_sync_meta.json")) {
    const local = readLocalJsonSync(rel);
    if (local != null) return local;
  }
  try {
    return await fetchUpstream(`/api/${rel}`);
  } catch (e) {
    const local = readLocalJsonSync(rel);
    if (local != null) return local;
    throw e;
  }
}

export async function loadProfilePanels(): Promise<ChroniclePanel[]> {
  if (isLocalFresh("_profile.json") || isLocalFresh("_sync_meta.json")) {
    const local = readLocalJsonSync("_profile.json") as { panels?: ChroniclePanel[] } | null;
    if (local?.panels?.length) return local.panels;
  }
  try {
    const upstream = (await fetchUpstream("/api/profile.json")) as { panels?: ChroniclePanel[] };
    return upstream.panels || [];
  } catch (e) {
    const local = readLocalJsonSync("_profile.json") as { panels?: ChroniclePanel[] } | null;
    if (local?.panels?.length) return local.panels;
    throw e;
  }
}

export async function loadPanelDataset(panel: ChroniclePanel): Promise<unknown> {
  const rel = resolveDatasetRel(panel);
  return loadChronicleJson(rel);
}

/** Optional write-through used by sync API (server only) */
export function writeLocalJson(relPath: string, data: unknown) {
  const full = path.join(LOCAL_ROOT, relPath);
  ensureDir(path.dirname(full));
  const tmp = `${full}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, full);
}
