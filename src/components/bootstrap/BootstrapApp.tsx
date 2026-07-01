import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { useBootstrapData } from "@/lib/bootstrap/useBootstrapData";
import {
  activePhase,
  daysBetween,
  formatDate,
  formatDateShort,
  hoursForTrack,
  newPhase,
  newTrack,
  phaseProgress,
  startOfMonthISO,
  startOfWeekISO,
  todayISO,
  trackProgress,
  uid,
} from "@/lib/bootstrap/utils";
import type { BootstrapData, Track } from "@/lib/bootstrap/types";
import { Badge, ProgressBar } from "@/components/bootstrap/ui";
import { LogSessionModal, PhaseManagerModal, TrackDetailModal } from "@/components/bootstrap/modals";
import { testConnection, type SupabaseSettings } from "@/lib/bootstrap/storage";

type Tab = "dashboard" | "sessions" | "completed" | "settings";

export function BootstrapApp() {
  const { data, update, settings, setSettings, status, loading } = useBootstrapData();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [phaseManagerOpen, setPhaseManagerOpen] = useState(false);
  const [detailTrackId, setDetailTrackId] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [logDefaultTrack, setLogDefaultTrack] = useState<string | null>(null);

  const phase = activePhase(data);
  const detailTrack = phase?.tracks.find((t) => t.id === detailTrackId) ?? null;

  const openLogSession = (trackId?: string) => {
    setLogDefaultTrack(trackId ?? null);
    setLogOpen(true);
  };

  return (
    <div className="min-h-screen bg-[var(--color-background)] pb-24">
      <div className="mx-auto max-w-[600px] px-4 pt-4">
        <TopBar status={status} loading={loading} />

        {tab === "dashboard" && (
          <DashboardView
            data={data}
            update={update}
            onOpenPhaseManager={() => setPhaseManagerOpen(true)}
            onOpenTrack={setDetailTrackId}
            onLog={openLogSession}
          />
        )}
        {tab === "sessions" && <SessionsView data={data} update={update} />}
        {tab === "completed" && <CompletedView data={data} update={update} />}
        {tab === "settings" && <SettingsView settings={settings} setSettings={setSettings} />}
      </div>

      <BottomTabs tab={tab} setTab={setTab} />

      <TrackDetailModal
        open={!!detailTrack}
        onClose={() => setDetailTrackId(null)}
        track={detailTrack}
        phase={phase}
        data={data}
        update={update}
        openLogSession={(id) => {
          setDetailTrackId(null);
          openLogSession(id);
        }}
      />
      <LogSessionModal
        open={logOpen}
        onClose={() => setLogOpen(false)}
        data={data}
        update={update}
        phase={phase}
        defaultTrackId={logDefaultTrack}
      />
      <PhaseManagerModal
        open={phaseManagerOpen}
        onClose={() => setPhaseManagerOpen(false)}
        data={data}
        update={update}
      />

      <Toaster />
    </div>
  );
}

function TopBar({ status, loading }: { status: string; loading: boolean }) {
  const label =
    loading ? "Loading…" :
    status === "saving" ? "Saving…" :
    status === "saved" ? "Synced ✓" :
    status === "error" ? "Sync error" :
    status === "offline" ? "Offline" : "";
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-accent)]/20 text-[var(--color-accent-2)]">⚡</div>
        <span className="text-sm font-semibold tracking-tight">Bootstrap</span>
      </div>
      {label && (
        <span className={`text-xs ${status === "error" ? "text-[var(--color-danger)]" : "text-[var(--color-muted-foreground)]"}`}>
          {label}
        </span>
      )}
    </div>
  );
}

function DashboardView({
  data,
  update,
  onOpenPhaseManager,
  onOpenTrack,
  onLog,
}: {
  data: BootstrapData;
  update: (fn: (d: BootstrapData) => BootstrapData) => void;
  onOpenPhaseManager: () => void;
  onOpenTrack: (id: string) => void;
  onLog: (trackId?: string) => void;
}) {
  const phase = activePhase(data);

  if (!phase) {
    return (
      <div className="card mt-8 p-6 text-center">
        <div className="mb-2 text-4xl">🚀</div>
        <h2 className="text-lg font-semibold">Create your first phase</h2>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Phases group your tracks into focused time-boxed cycles.
        </p>
        <button
          className="btn-primary mt-4"
          onClick={() => {
            const start = todayISO();
            const endD = new Date();
            endD.setDate(endD.getDate() + 60);
            const end = endD.toISOString().slice(0, 10);
            update((d) => ({ ...d, phases: [newPhase("Phase 1", start, end)] }));
            toast.success("Phase 1 created");
          }}
        >
          Create Phase 1
        </button>
        <div className="mt-2">
          <button className="text-xs text-[var(--color-muted-foreground)] hover:underline" onClick={onOpenPhaseManager}>
            Advanced…
          </button>
        </div>
      </div>
    );
  }

  const daysLeft = daysBetween(todayISO(), phase.endDate);
  const daysLeftTone: "success" | "warning" | "danger" | "muted" =
    daysLeft < 0 ? "muted" : daysLeft < 7 ? "danger" : daysLeft < 14 ? "warning" : "success";
  const daysLeftLabel = daysLeft < 0 ? `Ended ${Math.abs(daysLeft)}d ago` : `${daysLeft} days left`;

  const addTrack = () => {
    const t = newTrack();
    update((d) => ({
      ...d,
      phases: d.phases.map((p) => (p.id === phase.id ? { ...p, tracks: [...p.tracks, t] } : p)),
    }));
    onOpenTrack(t.id);
  };

  const progress = phaseProgress(phase);

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <button
              className="text-left text-lg font-semibold hover:text-[var(--color-accent-2)]"
              onClick={onOpenPhaseManager}
            >
              {phase.name} ▾
            </button>
            <div className="text-xs text-[var(--color-muted-foreground)]">
              {formatDateShort(phase.startDate)} – {formatDate(phase.endDate)}
            </div>
          </div>
          <Badge tone={daysLeftTone}>{daysLeftLabel}</Badge>
        </div>
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-[var(--color-muted-foreground)]">
            <span>Phase progress</span>
            <span>{progress}%</span>
          </div>
          <ProgressBar value={progress} complete={progress === 100} />
        </div>
      </div>

      {phase.tracks.map((t) => (
        <TrackCard
          key={t.id}
          track={t}
          data={data}
          onClick={() => onOpenTrack(t.id)}
          onLog={() => onLog(t.id)}
        />
      ))}

      <button className="btn-ghost w-full" onClick={addTrack}>+ Add Track</button>
    </div>
  );
}

function TrackCard({
  track,
  data,
  onClick,
  onLog,
}: {
  track: Track;
  data: BootstrapData;
  onClick: () => void;
  onLog: () => void;
}) {
  const prog = trackProgress(track);
  const weekHours = hoursForTrack(data, track.id, startOfWeekISO());
  const done = track.subtasks.filter((s) => s.done).length;
  return (
    <div className="card overflow-hidden">
      <button className="block w-full p-4 text-left" onClick={onClick}>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface-2)] text-2xl">
            {track.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate font-semibold">{track.name}</h3>
                {track.description && (
                  <p className="truncate text-xs text-[var(--color-muted-foreground)]">{track.description}</p>
                )}
              </div>
              {track.endDate && <span className="whitespace-nowrap text-xs text-[var(--color-muted-foreground)]">{formatDateShort(track.endDate)}</span>}
            </div>
            <div className="mt-2">
              <ProgressBar value={prog} complete={prog === 100} />
              <div className="mt-1 flex justify-between text-xs text-[var(--color-muted-foreground)]">
                <span>{done}/{track.subtasks.length} subtasks</span>
                <span>{weekHours.toFixed(1)}h this week</span>
              </div>
            </div>
          </div>
        </div>
      </button>
      <div className="flex border-t border-[var(--color-border)]">
        <button
          className="flex-1 py-2 text-xs text-[var(--color-muted-foreground)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-foreground)]"
          onClick={(e) => {
            e.stopPropagation();
            onLog();
          }}
        >
          + Log Session
        </button>
      </div>
    </div>
  );
}

function SessionsView({
  data,
  update,
}: {
  data: BootstrapData;
  update: (fn: (d: BootstrapData) => BootstrapData) => void;
}) {
  const [filterTrack, setFilterTrack] = useState<string>("");

  const trackMap = useMemo(() => {
    const m = new Map<string, Track>();
    data.phases.forEach((p) => p.tracks.forEach((t) => m.set(t.id, t)));
    data.archivedTracks.forEach((a) => m.set(a.originalTrackData.id, a.originalTrackData));
    return m;
  }, [data]);

  const filtered = data.sessions
    .filter((s) => !filterTrack || s.trackId === filterTrack)
    .sort((a, b) => b.date.localeCompare(a.date));

  const grouped = useMemo(() => {
    const g = new Map<string, typeof filtered>();
    filtered.forEach((s) => {
      const arr = g.get(s.date) ?? [];
      arr.push(s);
      g.set(s.date, arr);
    });
    return Array.from(g.entries());
  }, [filtered]);

  const weekTotal = data.sessions
    .filter((s) => s.date >= startOfWeekISO())
    .reduce((sum, s) => sum + s.hours, 0);
  const monthTotal = data.sessions
    .filter((s) => s.date >= startOfMonthISO())
    .reduce((sum, s) => sum + s.hours, 0);

  const del = (id: string) => {
    if (!confirm("Delete this session?")) return;
    update((d) => ({ ...d, sessions: d.sessions.filter((s) => s.id !== id) }));
  };

  const allTracks = Array.from(trackMap.values());

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h2 className="mb-2 text-lg font-semibold">Sessions</h2>
        <div className="flex gap-4">
          <div>
            <div className="text-xs text-[var(--color-muted-foreground)]">This week</div>
            <div className="text-2xl font-bold text-[var(--color-accent-2)]">{weekTotal.toFixed(1)}h</div>
          </div>
          <div>
            <div className="text-xs text-[var(--color-muted-foreground)]">This month</div>
            <div className="text-2xl font-bold">{monthTotal.toFixed(1)}h</div>
          </div>
        </div>
      </div>

      <select className="input-base" value={filterTrack} onChange={(e) => setFilterTrack(e.target.value)}>
        <option value="">All tracks</option>
        {allTracks.map((t) => (
          <option key={t.id} value={t.id}>{t.icon} {t.name}</option>
        ))}
      </select>

      {grouped.length === 0 && (
        <p className="py-12 text-center text-sm text-[var(--color-muted-foreground)]">No sessions yet.</p>
      )}

      {grouped.map(([date, entries]) => (
        <div key={date} className="card p-3">
          <div className="mb-2 flex items-center justify-between text-xs text-[var(--color-muted-foreground)]">
            <span className="font-medium text-[var(--color-foreground)]">{formatDate(date)}</span>
            <span>{entries.reduce((s, x) => s + x.hours, 0).toFixed(1)}h</span>
          </div>
          <ul className="space-y-1">
            {entries.map((s) => {
              const t = trackMap.get(s.trackId);
              return (
                <li key={s.id} className="flex items-start gap-2 rounded-lg bg-[var(--color-surface-2)] p-2 text-sm">
                  <span className="text-lg">{t?.icon ?? "•"}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{t?.name ?? "Unknown"}</div>
                    {s.note && <div className="text-xs text-[var(--color-muted-foreground)]">{s.note}</div>}
                  </div>
                  <span className="whitespace-nowrap font-medium">{s.hours}h</span>
                  <button
                    className="text-[var(--color-muted-foreground)] hover:text-[var(--color-danger)]"
                    onClick={() => del(s.id)}
                    aria-label="Delete"
                  >✕</button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function CompletedView({
  data,
  update,
}: {
  data: BootstrapData;
  update: (fn: (d: BootstrapData) => BootstrapData) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const restore = (idx: number) => {
    const item = data.archivedTracks[idx];
    if (!item) return;
    const targetPhase = activePhase(data);
    if (!targetPhase) return toast.error("No active phase to restore into");
    update((d) => ({
      ...d,
      archivedTracks: d.archivedTracks.filter((_, i) => i !== idx),
      phases: d.phases.map((p) =>
        p.id === targetPhase.id
          ? {
              ...p,
              tracks: [
                ...p.tracks,
                { ...item.originalTrackData, completed: false, completedDate: null, completionType: null, id: uid() },
              ],
            }
          : p,
      ),
    }));
    toast.success("Restored");
  };

  const badges: Record<string, { tone: "success" | "warning" | "accent"; label: string }> = {
    proficient: { tone: "success", label: "✅ Proficient" },
    certified: { tone: "warning", label: "🏆 Certified" },
    done: { tone: "accent", label: "📦 Done" },
  };

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Completed</h2>
      {data.archivedTracks.length === 0 && (
        <p className="py-12 text-center text-sm text-[var(--color-muted-foreground)]">Nothing archived yet.</p>
      )}
      {data.archivedTracks
        .slice()
        .sort((a, b) => b.completedDate.localeCompare(a.completedDate))
        .map((a) => {
          const t = a.originalTrackData;
          const b = badges[a.completionType];
          const expanded = expandedId === t.id;
          const done = t.subtasks.filter((s) => s.done).length;
          return (
            <div key={t.id} className="card p-3">
              <button className="flex w-full items-start gap-3 text-left" onClick={() => setExpandedId(expanded ? null : t.id)}>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-surface-2)] text-2xl">{t.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="truncate font-semibold">{t.name}</h3>
                    <Badge tone={b.tone}>{b.label}</Badge>
                  </div>
                  <div className="text-xs text-[var(--color-muted-foreground)]">
                    {a.phaseName} · {formatDate(a.completedDate)}
                  </div>
                </div>
              </button>
              {expanded && (
                <div className="mt-3 space-y-2 border-t border-[var(--color-border)] pt-3">
                  {t.notes && <p className="whitespace-pre-wrap text-sm">{t.notes}</p>}
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    Subtasks: {done}/{t.subtasks.length} completed
                  </p>
                  <button
                    className="btn-ghost text-xs"
                    onClick={() => restore(data.archivedTracks.indexOf(a))}
                  >Restore to active phase</button>
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}

function SettingsView({
  settings,
  setSettings,
}: {
  settings: SupabaseSettings;
  setSettings: (s: SupabaseSettings) => void;
}) {
  const [draft, setDraft] = useState(settings);
  const [testing, setTesting] = useState(false);

  const save = () => {
    setSettings(draft);
    toast.success("Settings saved");
  };

  const test = async () => {
    setTesting(true);
    const r = await testConnection(draft);
    setTesting(false);
    if (r.ok) toast.success("Connection OK");
    else toast.error(r.message);
  };

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h2 className="mb-1 text-lg font-semibold">Supabase</h2>
        <p className="mb-3 text-xs text-[var(--color-muted-foreground)]">
          Credentials stay on this device. Data reads/writes a single row in the <code>user_data</code> table's{" "}
          <code>bootstrap_data</code> jsonb column.
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-[var(--color-muted-foreground)]">Supabase URL</label>
            <input
              className="input-base mt-1"
              placeholder="https://xxxxx.supabase.co"
              value={draft.url}
              onChange={(e) => setDraft({ ...draft, url: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-[var(--color-muted-foreground)]">Anon Key</label>
            <input
              className="input-base mt-1"
              type="password"
              value={draft.anonKey}
              onChange={(e) => setDraft({ ...draft, anonKey: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-[var(--color-muted-foreground)]">Row UUID</label>
            <input
              className="input-base mt-1"
              placeholder="uuid of your row in user_data"
              value={draft.rowId}
              onChange={(e) => setDraft({ ...draft, rowId: e.target.value })}
            />
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost flex-1" onClick={test} disabled={testing}>
              {testing ? "Testing…" : "Test connection"}
            </button>
            <button className="btn-primary flex-1" onClick={save}>Save settings</button>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <h3 className="text-sm font-semibold">SQL to set up</h3>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-[var(--color-surface-2)] p-3 text-xs text-[var(--color-muted-foreground)]"><code>{`create table if not exists user_data (
  id uuid primary key,
  bootstrap_data jsonb
);
-- Add appropriate RLS or a permissive policy for anon.`}</code></pre>
      </div>

      <div className="card p-4">
        <h3 className="text-sm font-semibold">About Bootstrap</h3>
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          v1.0 — a command center for focused, multi-week learning phases.
        </p>
      </div>
    </div>
  );
}

function BottomTabs({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const items: { id: Tab; icon: string; label: string }[] = [
    { id: "dashboard", icon: "🏠", label: "Home" },
    { id: "sessions", icon: "⏱", label: "Sessions" },
    { id: "completed", icon: "✅", label: "Done" },
    { id: "settings", icon: "⚙️", label: "Settings" },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur">
      <div className="mx-auto flex max-w-[600px]">
        {items.map((it) => {
          const active = tab === it.id;
          return (
            <button
              key={it.id}
              onClick={() => setTab(it.id)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-3 text-xs transition-colors ${
                active ? "text-[var(--color-accent-2)]" : "text-[var(--color-muted-foreground)]"
              }`}
            >
              <span className="text-lg">{it.icon}</span>
              <span>{it.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
