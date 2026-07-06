import type { BootstrapData, Phase, Subtask, TaskGroup, Track } from "./types";

export const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export function activePhase(data: BootstrapData): Phase | null {
  return data.phases.find((p) => p.isActive) ?? data.phases[0] ?? null;
}

export function daysBetween(fromISO: string, toISO: string): number {
  const a = new Date(fromISO + "T00:00:00");
  const b = new Date(toISO + "T00:00:00");
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function startOfWeekISO(iso = todayISO()): string {
  const d = new Date(iso + "T00:00:00");
  const day = d.getDay(); // 0=Sun
  const diff = (day + 6) % 7; // Monday start
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

export function startOfMonthISO(iso = todayISO()): string {
  return iso.slice(0, 8) + "01";
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function allSubtasks(t: Track): Subtask[] {
  const fromGroups = (t.groups ?? []).flatMap((g) => g.subtasks);
  const legacy = t.groups && t.groups.length > 0 ? [] : t.subtasks ?? [];
  return [...fromGroups, ...legacy];
}

export function trackProgress(t: Track): number {
  const all = allSubtasks(t);
  if (all.length === 0) return 0;
  const done = all.filter((s) => s.done).length;
  return Math.round((done / all.length) * 100);
}

export function trackSubtaskCounts(t: Track): { done: number; total: number } {
  const all = allSubtasks(t);
  return { done: all.filter((s) => s.done).length, total: all.length };
}

export function phaseProgress(p: Phase): number {
  const all = p.tracks.flatMap((t) => allSubtasks(t));
  if (all.length === 0) return 0;
  const done = all.filter((s) => s.done).length;
  return Math.round((done / all.length) * 100);
}

export function hoursForTrack(data: BootstrapData, trackId: string, sinceISO?: string): number {
  return data.sessions
    .filter((s) => s.trackId === trackId && (!sinceISO || s.date >= sinceISO))
    .reduce((sum, s) => sum + s.hours, 0);
}

export function tasksDoneInRange(t: Track, sinceISO: string): number {
  return allSubtasks(t).filter((s) => s.done && s.doneDate && s.doneDate >= sinceISO).length;
}

export function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateShort(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatRangeShort(a: string | null, b: string | null): string {
  if (!a && !b) return "";
  if (a && b) return `${formatDateShort(a)} – ${formatDateShort(b)}`;
  return formatDateShort((a || b)!);
}

export function newSubtask(text = "New subtask"): Subtask {
  return { id: uid(), text, done: false, doneDate: null, dueDate: null };
}

export function newGroup(label = "New group", startDate: string | null = null, endDate: string | null = null): TaskGroup {
  return { id: uid(), label, startDate, endDate, subtasks: [] };
}

export function newTrack(defaults: { startDate?: string | null; endDate?: string | null } = {}): Track {
  return {
    id: uid(),
    name: "New Track",
    icon: "📘",
    description: "",
    hoursPerDay: null,
    hoursPerWeek: null,
    totalHoursGoal: null,
    startDate: defaults.startDate ?? null,
    endDate: defaults.endDate ?? null,
    completed: false,
    completedDate: null,
    completionType: null,
    notes: "",
    subtasks: [],
    groups: [],
  };
}

export function newPhase(name: string, startDate: string, endDate: string): Phase {
  return {
    id: uid(),
    name,
    startDate,
    endDate,
    isActive: true,
    tracks: [],
  };
}

// Migrate any track that still has legacy top-level subtasks into a
// single "Tasks" group so the rest of the app only reads from groups.
export function migrateTrack(t: Track): Track {
  const groups = Array.isArray(t.groups) ? t.groups : [];
  const legacy = Array.isArray(t.subtasks) ? t.subtasks : [];
  if (groups.length === 0 && legacy.length > 0) {
    return {
      ...t,
      groups: [{ id: uid(), label: "Tasks", startDate: null, endDate: null, subtasks: legacy }],
      subtasks: [],
    };
  }
  return { ...t, groups, subtasks: [] };
}

export function migrateData(d: BootstrapData): BootstrapData {
  return {
    ...d,
    displayName: d.displayName ?? "",
    phases: (d.phases ?? []).map((p) => ({
      ...p,
      tracks: (p.tracks ?? []).map(migrateTrack),
    })),
    sessions: (d.sessions ?? []).map((s) => ({ ...s, weekGroupId: s.weekGroupId ?? null })),
    archivedTracks: (d.archivedTracks ?? []).map((a) => ({
      ...a,
      totalHours: a.totalHours ?? 0,
      totalSessions: a.totalSessions ?? 0,
      finalNote: a.finalNote ?? "",
      originalTrackData: migrateTrack(a.originalTrackData),
    })),
  };
}

export function sortedGroups(t: Track): TaskGroup[] {
  return [...(t.groups ?? [])].sort((a, b) => {
    const av = a.startDate ?? "9999-12-31";
    const bv = b.startDate ?? "9999-12-31";
    return av.localeCompare(bv);
  });
}

export function activeGroup(t: Track, iso = todayISO()): TaskGroup | null {
  const gs = sortedGroups(t);
  return (
    gs.find((g) => g.startDate && g.endDate && iso >= g.startDate && iso <= g.endDate) ?? null
  );
}

export function isGroupOverdue(g: TaskGroup, iso = todayISO()): boolean {
  if (!g.endDate) return false;
  if (iso <= g.endDate) return false;
  if (g.subtasks.length === 0) return false;
  return g.subtasks.some((s) => !s.done);
}

// Weekly streak: consecutive weeks (Mon–Sun) with ≥1 session, anchored on
// the current week if it has sessions, otherwise on last week.
export function weeklyStreak(sessions: { date: string }[]): number {
  const weeks = new Set<string>();
  for (const s of sessions) weeks.add(startOfWeekISO(s.date));
  const thisWeek = startOfWeekISO();
  const lastWeek = addDaysISO(thisWeek, -7);
  let cursor: string;
  if (weeks.has(thisWeek)) cursor = thisWeek;
  else if (weeks.has(lastWeek)) cursor = lastWeek;
  else return 0;
  let count = 0;
  while (weeks.has(cursor)) {
    count += 1;
    cursor = addDaysISO(cursor, -7);
  }
  return count;
}

export const MOTIVATIONAL_QUOTES = [
  "Small daily reps > heroic weekends.",
  "You're closer than yesterday.",
  "Do the boring rep. That's the whole trick.",
  "Consistency compounds.",
  "Progress, not perfection.",
  "Start ugly. Iterate.",
  "One focused hour beats four distracted ones.",
  "Show up on the low-motivation days.",
  "The work you avoid is the work that grows you.",
  "Master the fundamentals. The rest follows.",
  "Ship the messy first draft.",
  "You've done hard things before.",
  "Curiosity is a superpower — feed it.",
  "Rest is part of the plan.",
];

export function quoteForToday(): string {
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 0);
  const day = Math.floor((d.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return MOTIVATIONAL_QUOTES[day % MOTIVATIONAL_QUOTES.length];
}
