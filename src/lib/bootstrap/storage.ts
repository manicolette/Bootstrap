import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type SupabaseSettings = {
  url: string;
  anonKey: string;
  rowId: string;
};

const SETTINGS_KEY = "bootstrap.settings";
const DATA_CACHE_KEY = "bootstrap.data.cache";

export function loadSettings(): SupabaseSettings {
  if (typeof window === "undefined") return { url: "", anonKey: "", rowId: "" };
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { url: "", anonKey: "", rowId: "" };
    return JSON.parse(raw);
  } catch {
    return { url: "", anonKey: "", rowId: "" };
  }
}

export function saveSettings(s: SupabaseSettings) {
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function loadCache<T>(): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DATA_CACHE_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveCache<T>(data: T) {
  try {
    window.localStorage.setItem(DATA_CACHE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

let cachedClient: SupabaseClient | null = null;
let cachedKey = "";

export function getClient(s: SupabaseSettings): SupabaseClient | null {
  if (!s.url || !s.anonKey) return null;
  const key = `${s.url}::${s.anonKey}`;
  if (cachedClient && cachedKey === key) return cachedClient;
  cachedClient = createClient(s.url, s.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  cachedKey = key;
  return cachedClient;
}

export async function fetchRow(s: SupabaseSettings): Promise<unknown | null> {
  const c = getClient(s);
  if (!c || !s.rowId) return null;
  const { data, error } = await c
    .from("user_data")
    .select("bootstrap_data")
    .eq("id", s.rowId)
    .maybeSingle();
  if (error) throw error;
  return data?.bootstrap_data ?? null;
}

export async function upsertRow(s: SupabaseSettings, payload: unknown): Promise<void> {
  const c = getClient(s);
  if (!c || !s.rowId) throw new Error("Supabase not configured");
  const { error } = await c
    .from("user_data")
    .upsert({ id: s.rowId, bootstrap_data: payload }, { onConflict: "id" });
  if (error) throw error;
}

export async function testConnection(s: SupabaseSettings): Promise<{ ok: boolean; message: string }> {
  try {
    const c = getClient(s);
    if (!c) return { ok: false, message: "Missing URL or key" };
    const { error } = await c.from("user_data").select("id").eq("id", s.rowId).maybeSingle();
    if (error) return { ok: false, message: error.message };
    return { ok: true, message: "Connected" };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export function subscribeRow(
  s: SupabaseSettings,
  onChange: (payload: unknown) => void,
): (() => void) | null {
  const c = getClient(s);
  if (!c || !s.rowId) return null;
  const channel = c
    .channel(`user_data:${s.rowId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "user_data", filter: `id=eq.${s.rowId}` },
      (payload: { new?: { bootstrap_data?: unknown } }) => {
        if (payload?.new && "bootstrap_data" in payload.new) {
          onChange(payload.new.bootstrap_data);
        }
      },
    )
    .subscribe();
  return () => {
    c.removeChannel(channel);
  };
}
