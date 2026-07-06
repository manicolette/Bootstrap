import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { useBootstrapData } from "@/lib/bootstrap/useBootstrapData";
import {
  activeGroup,
  activePhase,
  daysBetween,
  formatDate,
  formatDateShort,
  formatRangeShort,
  hoursForTrack,
  isGroupOverdue,
  newPhase,
  newTrack,
  phaseProgress,
  quoteForToday,
  sortedGroups,
  startOfMonthISO,
  startOfWeekISO,
  tasksDoneInRange,
  todayISO,
  trackProgress,
  trackSubtaskCounts,
  uid,
  weeklyStreak,
} from "@/lib/bootstrap/utils";
import type { BootstrapData, Session, Track } from "@/lib/bootstrap/types";
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
  const [editSession, setEditSession] = useState<Session | null>(null);

  const phase = activePhase(data);
  const detailTrack = phase?.tracks.find((t) => t.id === detailTrackId) ?? null;

  const openLogSession = (trackId?: string) => {
    setEditSession(null);
    setLogDefaultTrack(trackId ?? null);
    setLogOpen(true);
  };

  const openEditSession = (s: Session) => {
    setEditSession(s);
    setLogDefaultTrack(s.trackId);
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
        {tab === "sessions" && <SessionsView data={data} update={update} onEdit={openEditSession} />}
        {tab === "completed" && <CompletedView data={data} update={update} />}
        {tab === "settings" && (
          <SettingsView
            settings={settings}
            setSettings={setSettings}
            data={data}
            update={update}
          />
        )}
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
        onClose={() => {
          setLogOpen(false);
          setEditSession(null);
        }}
        data={data}
        update={update}
        phase={phase}
        defaultTrackId={logDefaultTrack}
        editSession={editSession}
      />
      <PhaseManagerModal
        open={phaseManagerOpen}
        onClose={() => setPhaseManagerOpen(false)}
        data={data}
        update={update}
        onReturnToDashboard={() => setTab("dashboard")}
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
  const streak = useMemo(() => weeklyStreak(data.sessions), [data.sessions]);
  const quote = useMemo(() => quoteForToday(), []);
  const greeting = data.displayName?.trim()
    ? `Welcome back, ${data.displayName.trim()} ⚡`
    : "Welcome back ⚡";

  if (!phase) {
    return (
      <div className="space-y-4">
        <GreetingHeader greeting={greeting} streak={streak} quote={quote} onQuickLog={() => onLog()} disabled />
        <div className="card mt-4 p-6 text-center">
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
      </div>
    );
  }

  const daysLeft = daysBetween(todayISO(), phase.endDate);
  const daysLeftTone: "success" | "warning" | "danger" | "muted" =
    daysLeft < 0 ? "muted" : daysLeft < 7 ? "danger" : daysLeft < 14 ? "warning" : "success";
  const daysLeftLabel = daysLeft < 0 ? `Ended ${Math.abs(daysLeft)}d ago` : `${daysLeft} days left`;

  const addTrack = () => {
    const t = newTrack({ startDate: phase.startDate, endDate: phase.endDate });
    update((d) => ({
      ...d,
      phases: d.phases.map((p) => (p.id === phase.id ? { ...p, tracks: [...p.tracks, t] } : p)),
    }));
    onOpenTrack(t.id);
  };

  const progress = phaseProgress(phase);

  return (
    <div className="space-y-4">
      <GreetingHeader greeting={greeting} streak={streak} quote={quote} onQuickLog={() => onLog()} />

      <div className="card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
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

function GreetingHeader({
  greeting,
  streak,
  quote,
  onQuickLog,
  disabled,
}: {
  greeting: string;
  streak: number;
  quote: string;
  onQuickLog: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold">{greeting}</h1>
          <p className="mt-1 text-xs italic text-[var(--color-muted-foreground)]">"{quote}"</p>
        </div>
        {streak > 0 && (
          <Badge tone="warning">🔥 {streak} week{streak === 1 ? "" : "s"}</Badge>
        )}
      </div>
      <button
        className="btn-primary mt-3 w-full"
        onClick={onQuickLog}
        disabled={disabled}
        title={disabled ? "Create a phase first" : "Log a study session"}
      >
        + Quick Log Session
      </button>
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
  const counts = trackSubtaskCounts(track);
  const weekStart = startOfWeekISO();
  const weekHours = hoursForTrack(data, track.id, weekStart);
  const weekTasks = tasksDoneInRange(track, weekStart);
  const daysLeft = track.endDate ? daysBetween(todayISO(), track.endDate) : null;
  const current = activeGroup(track);
  const overdueGroup = sortedGroups(track).find((g) => isGroupOverdue(g));
  const dateRange = formatRangeShort(track.startDate, track.endDate);

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
              {dateRange && (
                <span className="whitespace-nowrap text-xs text-[var(--color-muted-foreground)]">{dateRange}</span>
              )}
            </div>
            <div className="mt-2">
              <ProgressBar value={prog} complete={prog === 100 && counts.total > 0} />
              <div className="mt-1 flex justify-between text-xs text-[var(--color-muted-foreground)]">
                <span>{counts.done}/{counts.total} tasks</span>
                <span>{weekHours.toFixed(1)}h this week</span>
              </div>
            </div>
            {(current || overdueGroup) && (
              <div className="mt-2 flex flex-wrap items-center gap-1 text-xs">
                {current && (
                  <Badge tone="accent">
                    Now: {current.label}
                    {current.startDate && current.endDate && ` · ${formatRangeShort(current.startDate, current.endDate)}`}
                  </Badge>
                )}
                {overdueGroup && overdueGroup.id !== current?.id && (
                  <Badge tone="danger">Overdue: {overdueGroup.label}</Badge>
                )}
              </div>
            )}
            <div className="mt-2 text-xs text-[var(--color-muted-foreground)]">
              {weekTasks} task{weekTasks === 1 ? "" : "s"} this week · {weekHours.toFixed(1)}h logged
              {daysLeft !== null && ` · ${daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}`}
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
  onEdit,
}: {
  data: BootstrapData;
  update: (fn: (d: BootstrapData) => BootstrapData) => void;
  onEdit: (s: Session) => void;
}) {
  const [filterTrack, setFilterTrack] = useState<string>("");
  const [expanded, setExpanded] = useState<string | null>(null);

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

  const weekStart = startOfWeekISO();
  const monthStart = startOfMonthISO();
  const weekTotal = data.sessions
    .filter((s) => s.date >= weekStart)
    .reduce((sum, s) => sum + s.hours, 0);
  const monthTotal = data.sessions
    .filter((s) => s.date >= monthStart)
    .reduce((sum, s) => sum + s.hours, 0);

  const weekByGroup = useMemo(() => {
    const m = new Map<string, number>();
    data.sessions
      .filter((s) => s.date >= weekStart && s.weekGroupId)
      .forEach((s) => m.set(s.weekGroupId!, (m.get(s.weekGroupId!) ?? 0) + s.hours));
    const rows: { label: string; hours: number }[] = [];
    for (const [gid, hours] of m) {
      let label = "Group";
      for (const t of trackMap.values()) {
        const g = t.groups?.find((x) => x.id === gid);
        if (g) {
          label = `${t.icon} ${g.label}`;
          break;
        }
      }
      rows.push({ label, hours });
    }
    return rows.sort((a, b) => b.hours - a.hours);
  }, [data.sessions, trackMap, weekStart]);

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
        {weekByGroup.length > 0 && (
          <div className="mt-3 border-t border-[var(--color-border)] pt-3">
            <div className="mb-1 text-xs text-[var(--color-muted-foreground)]">Hours by group this week</div>
            <ul className="space-y-0.5 text-sm">
              {weekByGroup.map((r) => (
                <li key={r.label} className="flex justify-between">
                  <span className="truncate">{r.label}</span>
                  <span className="tabular-nums">{r.hours.toFixed(1)}h</span>
                </li>
              ))}
            </ul>
          </div>
        )}
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
              const isOpen = expanded === s.id;
              const groupLabel = t?.groups?.find((g) => g.id === s.weekGroupId)?.label;
              return (
                <li key={s.id} className="rounded-lg bg-[var(--color-surface-2)] text-sm">
                  <button
                    className="flex w-full items-start gap-2 p-2 text-left"
                    onClick={() => setExpanded(isOpen ? null : s.id)}
                  >
                    <span className="text-lg">{t?.icon ?? "•"}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{t?.name ?? "Unknown"}</div>
                      {groupLabel && (
                        <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
                          {groupLabel}
                        </div>
                      )}
                      {s.note && !isOpen && (
                        <div className="truncate text-xs text-[var(--color-muted-foreground)]">{s.note}</div>
                      )}
                    </div>
                    <span className="whitespace-nowrap font-medium">{s.hours}h</span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-[var(--color-border)]/60 p-2">
                      {s.note && (
                        <p className="whitespace-pre-wrap text-xs text-[var(--color-muted-foreground)]">{s.note}</p>
                      )}
                      <div className="mt-2 flex gap-2">
                        <button
                          className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs hover:border-[var(--color-accent)]"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(s);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-muted-foreground)] hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"
                          onClick={(e) => {
                            e.stopPropagation();
                            del(s.id);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
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
          const counts = trackSubtaskCounts(t);
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
                <div className="mt-3 space-y-2 border-t border-[var(--color-border)] pt-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <MiniStat label="Total hours" value={`${(a.totalHours ?? 0).toFixed(1)}h`} />
                    <MiniStat label="Sessions" value={String(a.totalSessions ?? 0)} />
                    <MiniStat label="Started" value={t.startDate ? formatDateShort(t.startDate) : "—"} />
                    <MiniStat label="Completed" value={formatDateShort(a.completedDate)} />
                  </div>
                  {a.finalNote && (
                    <div>
                      <div className="text-xs text-[var(--color-muted-foreground)]">Final note</div>
                      <p className="whitespace-pre-wrap text-sm">{a.finalNote}</p>
                    </div>
                  )}
                  {t.notes && (
                    <div>
                      <div className="text-xs text-[var(--color-muted-foreground)]">Notes</div>
                      <p className="whitespace-pre-wrap text-sm">{t.notes}</p>
                    </div>
                  )}
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    Tasks: {counts.done}/{counts.total} completed
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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[var(--color-surface-2)] p-2">
      <div className="text-xs text-[var(--color-muted-foreground)]">{label}</div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}

function SettingsView({
  settings,
  setSettings,
  data,
  update,
}: {
  settings: SupabaseSettings;
  setSettings: (s: SupabaseSettings) => void;
  data: BootstrapData;
  update: (fn: (d: BootstrapData) => BootstrapData) => void;
}) {
  const [draft, setDraft] = useState(settings);
  const [testing, setTesting] = useState(false);

  const save = () => {
    setSettings(draft);
    // Persist to localStorage via storage.saveSettings? setSettings state; save happens in hook indirectly.
    try {
      window.localStorage.setItem("bootstrap.settings", JSON.stringify(draft));
    } catch {}
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
        <h2 className="mb-1 text-lg font-semibold">Profile</h2>
        <p className="mb-3 text-xs text-[var(--color-muted-foreground)]">
          Used on the dashboard greeting.
        </p>
        <label className="text-xs text-[var(--color-muted-foreground)]">Display name</label>
        <input
          className="input-base mt-1"
          placeholder="Your name"
          value={data.displayName ?? ""}
          onChange={(e) => update((d) => ({ ...d, displayName: e.target.value }))}
        />
      </div>

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
-- Enable realtime on the table for cross-device sync.
-- Add appropriate RLS or a permissive policy for anon.`}</code></pre>
      </div>

      <div className="card p-4">
        <h3 className="text-sm font-semibold">About Bootstrap</h3>
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          v1.1 — a command center for focused, multi-week learning phases.
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
