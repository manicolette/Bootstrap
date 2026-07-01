import type { BootstrapData, Phase, Track } from "./types";

export const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

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

export function trackProgress(t: Track): number {
  if (t.subtasks.length === 0) return 0;
  const done = t.subtasks.filter((s) => s.done).length;
  return Math.round((done / t.subtasks.length) * 100);
}

export function phaseProgress(p: Phase): number {
  const all = p.tracks.flatMap((t) => t.subtasks);
  if (all.length === 0) return 0;
  const done = all.filter((s) => s.done).length;
  return Math.round((done / all.length) * 100);
}

export function hoursForTrack(data: BootstrapData, trackId: string, sinceISO?: string): number {
  return data.sessions
    .filter((s) => s.trackId === trackId && (!sinceISO || s.date >= sinceISO))
    .reduce((sum, s) => sum + s.hours, 0);
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

export function newTrack(): Track {
  return {
    id: uid(),
    name: "New Track",
    icon: "📘",
    description: "",
    hoursPerDay: null,
    hoursPerWeek: null,
    totalHoursGoal: null,
    endDate: null,
    completed: false,
    completedDate: null,
    completionType: null,
    notes: "",
    subtasks: [],
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
