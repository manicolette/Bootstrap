import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { BootstrapData, Phase, Track, CompletionType, Subtask } from "@/lib/bootstrap/types";
import {
  formatDate,
  formatDateShort,
  hoursForTrack,
  startOfWeekISO,
  todayISO,
  trackProgress,
  uid,
} from "@/lib/bootstrap/utils";
import { Badge, EmojiPicker, Modal, ProgressBar } from "./ui";

export function TrackDetailModal({
  open,
  onClose,
  track,
  phase,
  data,
  update,
  openLogSession,
}: {
  open: boolean;
  onClose: () => void;
  track: Track | null;
  phase: Phase | null;
  data: BootstrapData;
  update: (fn: (d: BootstrapData) => BootstrapData) => void;
  openLogSession: (trackId: string) => void;
}) {
  const [completePrompt, setCompletePrompt] = useState(false);

  if (!track || !phase) return null;

  const progress = trackProgress(track);
  const weekHours = hoursForTrack(data, track.id, startOfWeekISO());
  const totalHours = hoursForTrack(data, track.id);
  const trackSessions = data.sessions
    .filter((s) => s.trackId === track.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  const patchTrack = (patch: Partial<Track>) =>
    update((d) => ({
      ...d,
      phases: d.phases.map((p) =>
        p.id === phase.id
          ? { ...p, tracks: p.tracks.map((t) => (t.id === track.id ? { ...t, ...patch } : t)) }
          : p,
      ),
    }));

  const patchSubtasks = (subtasks: Subtask[]) => patchTrack({ subtasks });

  const toggleSubtask = (sid: string) =>
    patchSubtasks(
      track.subtasks.map((s) =>
        s.id === sid ? { ...s, done: !s.done, doneDate: !s.done ? todayISO() : null } : s,
      ),
    );

  const addSubtask = () =>
    patchSubtasks([...track.subtasks, { id: uid(), text: "New subtask", done: false, doneDate: null }]);

  const editSubtask = (sid: string, text: string) =>
    patchSubtasks(track.subtasks.map((s) => (s.id === sid ? { ...s, text } : s)));

  const deleteSubtask = (sid: string) => patchSubtasks(track.subtasks.filter((s) => s.id !== sid));

  const moveSubtask = (sid: string, dir: -1 | 1) => {
    const idx = track.subtasks.findIndex((s) => s.id === sid);
    const next = idx + dir;
    if (idx < 0 || next < 0 || next >= track.subtasks.length) return;
    const arr = [...track.subtasks];
    [arr[idx], arr[next]] = [arr[next], arr[idx]];
    patchSubtasks(arr);
  };

  const completeTrack = (type: Exclude<CompletionType, null>) => {
    update((d) => ({
      ...d,
      phases: d.phases.map((p) =>
        p.id === phase.id ? { ...p, tracks: p.tracks.filter((t) => t.id !== track.id) } : p,
      ),
      archivedTracks: [
        ...d.archivedTracks,
        {
          originalTrackData: { ...track, completed: true, completedDate: todayISO(), completionType: type },
          completedDate: todayISO(),
          completionType: type,
          phaseName: phase.name,
        },
      ],
    }));
    setCompletePrompt(false);
    toast.success(`Marked "${track.name}" complete`);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Track Detail" wide>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <EmojiPicker value={track.icon} onChange={(v) => patchTrack({ icon: v })} />
          <div className="flex-1">
            <input
              className="input-base text-lg font-semibold"
              value={track.name}
              onChange={(e) => patchTrack({ name: e.target.value })}
            />
            <input
              className="input-base mt-2 text-sm"
              placeholder="Description"
              value={track.description}
              onChange={(e) => patchTrack({ description: e.target.value })}
            />
          </div>
        </div>

        {progress === 100 && (
          <div className="rounded-lg border border-[var(--color-success)]/30 bg-[color-mix(in_oklab,var(--color-success)_10%,transparent)] p-3 text-sm text-[var(--color-success)]">
            All done! <button className="underline" onClick={() => setCompletePrompt(true)}>Mark as complete?</button>
          </div>
        )}

        <div>
          <div className="mb-1 flex justify-between text-xs text-[var(--color-muted-foreground)]">
            <span>Progress</span>
            <span>{track.subtasks.filter((s) => s.done).length}/{track.subtasks.length}</span>
          </div>
          <ProgressBar value={progress} complete={progress === 100} />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="text-xs text-[var(--color-muted-foreground)]">End date</label>
            <input
              type="date"
              className="input-base mt-1"
              value={track.endDate ?? ""}
              onChange={(e) => patchTrack({ endDate: e.target.value || null })}
            />
          </div>
          <div>
            <label className="text-xs text-[var(--color-muted-foreground)]">hrs/day</label>
            <input
              type="number"
              step="0.5"
              min="0"
              className="input-base mt-1"
              value={track.hoursPerDay ?? ""}
              onChange={(e) => patchTrack({ hoursPerDay: e.target.value ? Number(e.target.value) : null })}
            />
          </div>
          <div>
            <label className="text-xs text-[var(--color-muted-foreground)]">hrs/week</label>
            <input
              type="number"
              step="0.5"
              min="0"
              className="input-base mt-1"
              value={track.hoursPerWeek ?? ""}
              onChange={(e) => patchTrack({ hoursPerWeek: e.target.value ? Number(e.target.value) : null })}
            />
          </div>
          <div>
            <label className="text-xs text-[var(--color-muted-foreground)]">Total goal</label>
            <input
              type="number"
              step="1"
              min="0"
              className="input-base mt-1"
              value={track.totalHoursGoal ?? ""}
              onChange={(e) => patchTrack({ totalHoursGoal: e.target.value ? Number(e.target.value) : null })}
            />
          </div>
        </div>

        <div className="flex gap-4 text-sm text-[var(--color-muted-foreground)]">
          <span><b className="text-[var(--color-foreground)]">{weekHours.toFixed(1)}</b> hrs this week</span>
          <span><b className="text-[var(--color-foreground)]">{totalHours.toFixed(1)}</b> hrs total</span>
        </div>

        <div>
          <label className="text-xs text-[var(--color-muted-foreground)]">Notes</label>
          <textarea
            className="input-base mt-1 min-h-24"
            placeholder="Thoughts, links, references…"
            value={track.notes}
            onChange={(e) => patchTrack({ notes: e.target.value })}
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Subtasks</h3>
            <button className="btn-ghost text-xs" onClick={addSubtask}>+ Add</button>
          </div>
          <ul className="space-y-1">
            {track.subtasks.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1.5"
              >
                <input
                  type="checkbox"
                  checked={s.done}
                  onChange={() => toggleSubtask(s.id)}
                  className="h-4 w-4 accent-[var(--color-accent)]"
                />
                <input
                  className={`flex-1 bg-transparent outline-none ${s.done ? "text-[var(--color-muted-foreground)] line-through" : ""}`}
                  value={s.text}
                  onChange={(e) => editSubtask(s.id, e.target.value)}
                />
                <button
                  className="px-1 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
                  onClick={() => moveSubtask(s.id, -1)}
                  aria-label="Move up"
                >↑</button>
                <button
                  className="px-1 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
                  onClick={() => moveSubtask(s.id, 1)}
                  aria-label="Move down"
                >↓</button>
                <button
                  className="px-1 text-[var(--color-muted-foreground)] hover:text-[var(--color-danger)]"
                  onClick={() => deleteSubtask(s.id)}
                >✕</button>
              </li>
            ))}
            {track.subtasks.length === 0 && (
              <li className="rounded-lg border border-dashed border-[var(--color-border)] p-4 text-center text-sm text-[var(--color-muted-foreground)]">
                No subtasks yet
              </li>
            )}
          </ul>
        </div>

        {trackSessions.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold">Recent sessions</h3>
            <ul className="space-y-1 text-sm">
              {trackSessions.map((s) => (
                <li key={s.id} className="flex justify-between gap-3 rounded-lg bg-[var(--color-surface-2)] px-3 py-2">
                  <span className="text-[var(--color-muted-foreground)]">{formatDateShort(s.date)}</span>
                  <span className="flex-1 truncate">{s.note || <span className="text-[var(--color-muted-foreground)]">—</span>}</span>
                  <span className="font-medium">{s.hours}h</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="sticky bottom-0 -mx-4 -mb-4 flex gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <button className="btn-ghost flex-1" onClick={() => openLogSession(track.id)}>+ Log Session</button>
          <button className="btn-primary flex-1" onClick={() => setCompletePrompt(true)}>Mark Complete</button>
        </div>
      </div>

      <Modal open={completePrompt} onClose={() => setCompletePrompt(false)} title="How did it end?">
        <div className="grid gap-2">
          <button className="btn-ghost text-left" onClick={() => completeTrack("proficient")}>
            ✅ <b>Proficient</b> — I'm comfortable with this
          </button>
          <button className="btn-ghost text-left" onClick={() => completeTrack("certified")}>
            🏆 <b>Certified / Passed</b> — I passed a formal exam
          </button>
          <button className="btn-ghost text-left" onClick={() => completeTrack("done")}>
            📦 <b>Done</b> — Wrapping up
          </button>
        </div>
      </Modal>
    </Modal>
  );
}

export function LogSessionModal({
  open,
  onClose,
  data,
  update,
  phase,
  defaultTrackId,
}: {
  open: boolean;
  onClose: () => void;
  data: BootstrapData;
  update: (fn: (d: BootstrapData) => BootstrapData) => void;
  phase: Phase | null;
  defaultTrackId: string | null;
}) {
  const [trackId, setTrackId] = useState(defaultTrackId ?? phase?.tracks[0]?.id ?? "");
  const [date, setDate] = useState(todayISO());
  const [hours, setHours] = useState(1);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setTrackId(defaultTrackId ?? phase?.tracks[0]?.id ?? "");
      setDate(todayISO());
      setHours(1);
      setNote("");
    }
  }, [open, defaultTrackId, phase]);

  if (!phase) return null;

  const save = () => {
    if (!trackId) {
      toast.error("Pick a track");
      return;
    }
    if (phase.startDate && date < phase.startDate) toast.warning("Date is before phase start");
    if (phase.endDate && date > phase.endDate) toast.warning("Date is after phase end");
    update((d) => ({
      ...d,
      sessions: [
        ...d.sessions,
        { id: uid(), trackId, phaseId: phase.id, date, hours, note },
      ],
    }));
    toast.success(`Logged ${hours}h`);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Log Session">
      <div className="space-y-3">
        <div>
          <label className="text-xs text-[var(--color-muted-foreground)]">Track</label>
          <select className="input-base mt-1" value={trackId} onChange={(e) => setTrackId(e.target.value)}>
            {phase.tracks.map((t) => (
              <option key={t.id} value={t.id}>{t.icon} {t.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-[var(--color-muted-foreground)]">Date</label>
            <input type="date" className="input-base mt-1" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-[var(--color-muted-foreground)]">Hours</label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              className="input-base mt-1"
              value={hours}
              onChange={(e) => setHours(Number(e.target.value) || 0)}
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-[var(--color-muted-foreground)]">Note</label>
          <textarea
            className="input-base mt-1 min-h-20"
            placeholder="What did you cover?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1" onClick={save}>Save</button>
        </div>
      </div>
    </Modal>
  );
}

export function PhaseManagerModal({
  open,
  onClose,
  data,
  update,
}: {
  open: boolean;
  onClose: () => void;
  data: BootstrapData;
  update: (fn: (d: BootstrapData) => BootstrapData) => void;
}) {
  const [name, setName] = useState("");
  const [start, setStart] = useState(todayISO());
  const [end, setEnd] = useState(todayISO());

  const setActive = (id: string) =>
    update((d) => ({ ...d, phases: d.phases.map((p) => ({ ...p, isActive: p.id === id })) }));

  const patchPhase = (id: string, patch: Partial<Phase>) =>
    update((d) => ({ ...d, phases: d.phases.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));

  const deletePhase = (p: Phase) => {
    if (!confirm(`Delete "${p.name}"? Tracks will be archived.`)) return;
    update((d) => ({
      ...d,
      phases: d.phases.filter((x) => x.id !== p.id),
      archivedTracks: [
        ...d.archivedTracks,
        ...p.tracks.map((t) => ({
          originalTrackData: t,
          completedDate: todayISO(),
          completionType: "done" as const,
          phaseName: p.name,
        })),
      ],
    }));
  };

  const create = () => {
    if (!name.trim()) return toast.error("Name required");
    update((d) => ({
      ...d,
      phases: [
        ...d.phases.map((p) => ({ ...p, isActive: false })),
        { id: uid(), name: name.trim(), startDate: start, endDate: end, isActive: true, tracks: [] },
      ],
    }));
    setName("");
    toast.success("Phase created");
  };

  return (
    <Modal open={open} onClose={onClose} title="Phases">
      <div className="space-y-4">
        <div>
          <h3 className="mb-2 text-sm font-semibold">Create phase</h3>
          <div className="space-y-2">
            <input
              className="input-base"
              placeholder="Phase name (e.g. Phase 2)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <input type="date" className="input-base" value={start} onChange={(e) => setStart(e.target.value)} />
              <input type="date" className="input-base" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
            <button className="btn-primary w-full" onClick={create}>Create phase</button>
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold">All phases</h3>
          {data.phases.length === 0 && (
            <p className="text-sm text-[var(--color-muted-foreground)]">No phases yet.</p>
          )}
          <ul className="space-y-2">
            {data.phases.map((p) => (
              <li key={p.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
                <div className="flex items-center justify-between">
                  <input
                    className="bg-transparent font-semibold outline-none"
                    value={p.name}
                    onChange={(e) => patchPhase(p.id, { name: e.target.value })}
                  />
                  {p.isActive ? (
                    <Badge tone="accent">Active</Badge>
                  ) : (
                    <button className="text-xs text-[var(--color-accent-2)] hover:underline" onClick={() => setActive(p.id)}>
                      Make active
                    </button>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    className="input-base"
                    value={p.startDate}
                    onChange={(e) => patchPhase(p.id, { startDate: e.target.value })}
                  />
                  <input
                    type="date"
                    className="input-base"
                    value={p.endDate}
                    onChange={(e) => patchPhase(p.id, { endDate: e.target.value })}
                  />
                </div>
                <div className="mt-2 flex justify-between text-xs text-[var(--color-muted-foreground)]">
                  <span>{p.tracks.length} tracks</span>
                  <button className="hover:text-[var(--color-danger)]" onClick={() => deletePhase(p)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-[var(--color-muted-foreground)]">{formatDate(todayISO())}</p>
      </div>
    </Modal>
  );
}
