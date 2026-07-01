import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  fetchRow,
  loadCache,
  loadSettings,
  saveCache,
  upsertRow,
  type SupabaseSettings,
} from "./storage";
import { emptyData, type BootstrapData } from "./types";

type SyncStatus = "idle" | "saving" | "saved" | "error" | "offline";

export function useBootstrapData() {
  const [settings, setSettingsState] = useState<SupabaseSettings>(() => loadSettings());
  const [data, setData] = useState<BootstrapData>(() => loadCache<BootstrapData>() ?? emptyData());
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstLoad = useRef(true);

  // Load remote on mount / settings change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (settings.url && settings.anonKey && settings.rowId) {
          const remote = await fetchRow(settings);
          if (!cancelled && remote && typeof remote === "object") {
            const merged = { ...emptyData(), ...(remote as BootstrapData) };
            setData(merged);
            saveCache(merged);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setStatus("offline");
          toast.error("Could not load from Supabase — using local cache");
          console.error(e);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          isFirstLoad.current = false;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [settings.url, settings.anonKey, settings.rowId]);

  // Debounced save on data change
  useEffect(() => {
    if (isFirstLoad.current) return;
    saveCache(data);
    if (!settings.url || !settings.anonKey || !settings.rowId) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus("saving");
    timerRef.current = setTimeout(async () => {
      try {
        await upsertRow(settings, data);
        setStatus("saved");
        setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 1500);
      } catch (e) {
        setStatus("error");
        toast.error("Sync failed — cached locally");
        console.error(e);
      }
    }, 1000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, settings]);

  const update = useCallback((fn: (d: BootstrapData) => BootstrapData) => {
    setData((prev) => fn(prev));
  }, []);

  const setSettings = useCallback((s: SupabaseSettings) => {
    setSettingsState(s);
  }, []);

  return { data, update, settings, setSettings, status, loading };
}
