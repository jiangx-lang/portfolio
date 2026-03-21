/**
 * 浏览器端 Supabase（仅用于 NEXT_PUBLIC_* 可公开的 anon 场景：笔记/播客/报告读写）。
 * 勿在此文件使用 service_role。
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _browserClient: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!_browserClient) {
    _browserClient = createClient(url, key);
  }
  return _browserClient;
}

export function isBrowserSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );
}
