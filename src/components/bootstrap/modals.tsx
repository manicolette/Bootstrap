import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type {
  BootstrapData,
  Phase,
  Track,
  CompletionType,
  Subtask,
  TaskGroup,
  Session,
} from "@/lib/bootstrap/types";
import {
  activeGroup,
  allSubtasks,
  formatDate,
  formatDateShort,
  formatRangeShort,
  hoursForTrack,
  isGroupOverdue,
  newGroup,
  newSubtask,
  sortedGroups,
  startOfWeekISO,
  todayISO,
  trackProgress,
  trackSubtaskCounts,
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
  const [completeStep, setCompleteStep] = useState<null | "pick" | "summary">(null);
  const [pendingType, setPendingType] = useState<Exclude<CompletionType, null>>("done");
  const [finalNote, setFinalNote] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  if (!track || !phase) return null;

  const progress = trackProgress(track);
  const counts = trackSubtaskCounts(track);
  const weekHours = hoursForTrack(data, track.id, startOfWeekISO());
  const totalHours = hoursForTrack(data, track.id);
  const totalSessions = data.sessions.filter((s) => s.trackId === track.id).length;
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

  const patchGroups = (groups: TaskGroup[]) => patchTrack({ groups });

  const patchGroup = (gid: string, patch: Partial<TaskGroup>) =>
    patchGroups(track.groups.map((g) => (g.id === gid ? { ...g, ...patch } : g)));

  const patchSubtasksIn = (gid: string, subtasks: Subtask[]) => patchGroup(gid, { subtasks });

  const addGroup = () => {
    const g = newGroup(`Week ${track.groups.length + 1}`);
    patchGroups([...track.groups, g]);
  };

  const deleteGroup = (gid: string) => {
    if (!confirm("Delete this group and all its tasks?")) return;
    patchGroups(track.groups.filter((g) => g.id !== gid));
  };

  const toggleSubtask = (gid: string, sid: string) => {
    const g = track.groups.find((x) => x.id === gid);
    if (!g) return;
    patchSubtasksIn(
      gid,
      g.subtasks.map((s) =>
        s.id === sid ? { ...s, done: !s.done, doneDate: !s.done ? todayISO() : null } : s,
      ),
    );
  };

  const addSubtask = (gid: string) => {
    const g = track.groups.find((x) => x.id === gid);
    if (!g) return;
    patchSubtasksIn(gid, [...g.subtasks, newSubtask()]);
  };

  const editSubtask = (gid: string, sid: string, patch: Partial<Subtask>) => {
    const g = track.groups.find((x) => x.id === gid);
    if (!g) return;
    patchSubtasksIn(
      gid,
      g.subtasks.map((s) => (s.id === sid ? { ...s, ...patch } : s)),
    );
  };

  const deleteSubtask = (gid: string, sid: string) => {
    const g = track.groups.find((x) => x.id === gid);
    if (!g) return;
    patchSubtasksIn(gid, g.subtasks.filter((s) => s.id !== sid));
  };

  const moveSubtaskToGroup = (fromGid: string, sid: string, toGid: string) => {
    if (fromGid === toGid) return;
    const from = track.groups.find((x) => x.id === fromGid);
    const to = track.groups.find((x) => x.id === toGid);
    if (!from || !to) return;
    const sub = from.subtasks.find((s) => s.id === sid);
    if (!sub) return;
    patchGroups(
      track.groups.map((g) => {
        if (g.id === fromGid) return { ...g, subtasks: g.subtasks.filter((s) => s.id !== sid) };
        if (g.id === toGid) return { ...g, subtasks: [...g.subtasks, sub] };
        return g;
      }),
    );
  };

  const openCompleteFlow = () => {
    setPendingType("done");
    setFinalNote("");
    setCompleteStep("pick");
  };

  const archive = () => {
    update((d) => ({
      ...d,
      phases: d.phases.map((p) =>
        p.id === phase.id ? { ...p, tracks: p.tracks.filter((t) => t.id !== track.id) } : p,
      ),
      archivedTracks: [
        ...d.archivedTracks,
        {
          originalTrackData: { ...track, completed: true, completedDate: todayISO(), completionType: pendingType },
          completedDate: todayISO(),
          completionType: pendingType,
          phaseName: phase.name,
          totalHours,
          totalSessions,
          finalNote,
        },
      ],
    }));
    setCompleteStep(null);
    toast.success(`Archived "${track.name}"`);
    onClose();
  };

  const groups = sortedGroups(track);
  const currentGroup = activeGroup(track);

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

        {progress === 100 && counts.total > 0 && (
          <div className="rounded-lg border border-[var(--color-success)]/30 bg-[color-mix(in_oklab,var(--color-success)_10%,transparent)] p-3 text-sm text-[var(--color-success)]">
            All done!{" "}
            <button className="underline" onClick={openCompleteFlow}>
              Mark as complete?
            </button>
          </div>
        )}

        <div>
          <div className="mb-1 flex justify-between text-xs text-[var(--color-muted-foreground)]">
            <span>Progress</span>
            <span>
              {counts.done}/{counts.total}
            </span>
          </div>
          <ProgressBar value={progress} complete={progress === 100 && counts.total > 0} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-[var(--color-muted-foreground)]">Start date</label>
            <input
              type="date"
              className="input-base mt-1"
              value={track.startDate ?? ""}
              onChange={(e) => patchTrack({ startDate: e.target.value || null })}
            />
          </div>
          <div>
            <label className="text-xs text-[var(--color-muted-foreground)]">End date</label>
            <input
              type="date"
              className="input-base mt-1"
              value={track.endDate ?? ""}
              onChange={(e) => patchTrack({ endDate: e.target.value || null })}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
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
          <span>
            <b className="text-[var(--color-foreground)]">{weekHours.toFixed(1)}</b> hrs this week
          </span>
          <span>
            <b className="text-[var(--color-foreground)]">{totalHours.toFixed(1)}</b> hrs total
          </span>
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
            <h3 className="text-sm font-semibold">Task groups</h3>
            <button className="btn-ghost text-xs" onClick={addGroup}>
              + Add group
            </button>
          </div>

          {groups.length === 0 && (
            <div className="rounded-lg border border-dashed border-[var(--color-border)] p-4 text-center text-sm text-[var(--color-muted-foreground)]">
              No groups yet — add one like "Week 1 — Setup".
            </div>
          )}

          <ul className="space-y-3">
            {groups.map((g) => {
              const isCollapsed = !!collapsed[g.id];
              const overdue = isGroupOverdue(g);
              const isActive = currentGroup?.id === g.id;
              const groupDone = g.subtasks.filter((s) => s.done).length;
              return (
                <li
                  key={g.id}
                  className={`rounded-lg border ${
                    isActive
                      ? "border-[var(--color-accent)]/60 bg-[color-mix(in_oklab,var(--color-accent)_8%,transparent)]"
                      : "border-[var(--color-border)] bg-[var(--color-surface-2)]"
                  }`}
                >
                  <div className="flex items-center gap-2 p-2">
                    <button
                      className="w-6 text-[var(--color-muted-foreground)]"
                      onClick={() => setCollapsed((c) => ({ ...c, [g.id]: !isCollapsed }))}
                      aria-label={isCollapsed ? "Expand" : "Collapse"}
                    >
                      {isCollapsed ? "▸" : "▾"}
                    </button>
                    <input
                      className="flex-1 bg-transparent font-medium outline-none"
                      value={g.label}
                      onChange={(e) => patchGroup(g.id, { label: e.target.value })}
                    />
                    <div className="flex flex-wrap items-center gap-1 text-xs text-[var(--color-muted-foreground)]">
                      {isActive && <Badge tone="accent">Current</Badge>}
                      {overdue && <Badge tone="danger">Overdue</Badge>}
                      <span className="tabular-nums">
                        {groupDone}/{g.subtasks.length}
                      </span>
                    </div>
                    <button
                      className="px-1 text-[var(--color-muted-foreground)] hover:text-[var(--color-danger)]"
                      onClick={() => deleteGroup(g.id)}
                      aria-label="Delete group"
                    >
                      ✕
                    </button>
                  </div>

                  {!isCollapsed && (
                    <div className="border-t border-[var(--color-border)]/60 p-2">
                      <div className="mb-2 grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">Start</label>
                          <input
                            type="date"
                            className="input-base mt-0.5"
                            value={g.startDate ?? ""}
                            onChange={(e) => patchGroup(g.id, { startDate: e.target.value || null })}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">End</label>
                          <input
                            type="date"
                            className="input-base mt-0.5"
                            value={g.endDate ?? ""}
                            onChange={(e) => patchGroup(g.id, { endDate: e.target.value || null })}
                          />
                        </div>
                      </div>
                      {(g.startDate || g.endDate) && (
                        <div className="mb-2 text-xs text-[var(--color-muted-foreground)]">
                          {formatRangeShort(g.startDate, g.endDate)}
                        </div>
                      )}

                      <ul className="space-y-1">
                        {g.subtasks.map((s) => (
                          <li
                            key={s.id}
                            className="flex flex-wrap items-center gap-2 rounded-md bg-[var(--color-surface)] px-2 py-1.5"
                          >
                            <input
                              type="checkbox"
                              checked={s.done}
                              onChange={() => toggleSubtask(g.id, s.id)}
                              className="h-4 w-4 accent-[var(--color-accent)]"
                            />
                            <input
                              className={`min-w-0 flex-1 bg-transparent outline-none ${
                                s.done ? "text-[var(--color-muted-foreground)] line-through" : ""
                              }`}
                              value={s.text}
                              onChange={(e) => editSubtask(g.id, s.id, { text: e.target.value })}
                            />
                            <input
                              type="date"
                              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-1 py-0.5 text-xs text-[var(--color-muted-foreground)]"
                              value={s.dueDate ?? ""}
                              onChange={(e) => editSubtask(g.id, s.id, { dueDate: e.target.value || null })}
                              title="Due date"
                            />
                            {track.groups.length > 1 && (
                              <select
                                className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-1 py-0.5 text-xs text-[var(--color-muted-foreground)]"
                                value=""
                                onChange={(e) => {
                                  if (e.target.value) moveSubtaskToGroup(g.id, s.id, e.target.value);
                                }}
                                title="Move to group"
                              >
                                <option value="">Move…</option>
                                {track.groups
                                  .filter((x) => x.id !== g.id)
                                  .map((x) => (
                                    <option key={x.id} value={x.id}>
                                      {x.label}
                                    </option>
                                  ))}
                              </select>
                            )}
                            <button
                              className="px-1 text-[var(--color-muted-foreground)] hover:text-[var(--color-danger)]"
                              onClick={() => deleteSubtask(g.id, s.id)}
                            >
                              ✕
                            </button>
                          </li>
                        ))}
                      </ul>
                      <button
                        className="mt-2 text-xs text-[var(--color-accent-2)] hover:underline"
                        onClick={() => addSubtask(g.id)}
                      >
                        + Add task
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {trackSessions.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold">Recent sessions</h3>
            <ul className="space-y-1 text-sm">
              {trackSessions.map((s) => (
                <li key={s.id} className="flex justify-between gap-3 rounded-lg bg-[var(--color-surface-2)] px-3 py-2">
                  <span className="text-[var(--color-muted-foreground)]">{formatDateShort(s.date)}</span>
                  <span className="flex-1 truncate">
                    {s.note || <span className="text-[var(--color-muted-foreground)]">—</span>}
                  </span>
                  <span className="font-medium">{s.hours}h</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="sticky bottom-0 -mx-4 -mb-4 flex gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <button className="btn-ghost flex-1" onClick={() => openLogSession(track.id)}>
            + Log Session
          </button>
          <button className="btn-primary flex-1" onClick={openCompleteFlow}>
            Mark Complete
          </button>
        </div>
      </div>

      <Modal open={completeStep === "pick"} onClose={() => setCompleteStep(null)} title="How did it end?">
        <div className="grid gap-2">
          {(
            [
              ["proficient", "✅", "Proficient", "I'm comfortable with this"],
              ["certified", "🏆", "Certified / Passed", "I passed a formal exam"],
              ["done", "📦", "Done", "Wrapping up"],
            ] as [Exclude<CompletionType, null>, string, string, string][]
          ).map(([type, icon, label, desc]) => (
            <button
              key={type}
              className="btn-ghost text-left"
              onClick={() => {
                setPendingType(type);
                setCompleteStep("summary");
              }}
            >
              {icon} <b>{label}</b> — {desc}
            </button>
          ))}
        </div>
      </Modal>

      <Modal open={completeStep === "summary"} onClose={() => setCompleteStep(null)} title="Completion summary">
        <div className="space-y-3">
          <div className="rounded-lg bg-[var(--color-surface-2)] p-3 text-center">
            <div className="text-3xl">{track.icon}</div>
            <div className="mt-1 text-lg font-semibold">{track.name}</div>
            <Badge tone={pendingType === "certified" ? "warning" : pendingType === "proficient" ? "success" : "accent"}>
              {pendingType === "certified" ? "🏆 Certified" : pendingType === "proficient" ? "✅ Proficient" : "📦 Done"}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <SummaryStat label="Total hours" value={`${totalHours.toFixed(1)}h`} />
            <SummaryStat label="Sessions" value={String(totalSessions)} />
            <SummaryStat label="Started" value={track.startDate ? formatDateShort(track.startDate) : "—"} />
            <SummaryStat label="Completed" value={formatDateShort(todayISO())} />
          </div>
          <div>
            <label className="text-xs text-[var(--color-muted-foreground)]">Final note (optional)</label>
            <textarea
              className="input-base mt-1 min-h-20"
              placeholder="What did you learn? What would you do differently?"
              value={finalNote}
              onChange={(e) => setFinalNote(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost flex-1" onClick={() => setCompleteStep("pick")}>
              Back
            </button>
            <button className="btn-primary flex-1" onClick={archive}>
              Archive track
            </button>
          </div>
        </div>
      </Modal>
    </Modal>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[var(--color-surface-2)] p-2">
      <div className="text-xs text-[var(--color-muted-foreground)]">{label}</div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}

export function LogSessionModal({
  open,
  onClose,
  data,
  update,
  phase,
  defaultTrackId,
  editSession,
}: {
  open: boolean;
  onClose: () => void;
  data: BootstrapData;
  update: (fn: (d: BootstrapData) => BootstrapData) => void;
  phase: Phase | null;
  defaultTrackId: string | null;
  editSession?: Session | null;
}) {
  const isEdit = !!editSession;
  const [trackId, setTrackId] = useState(editSession?.trackId ?? defaultTrackId ?? phase?.tracks[0]?.id ?? "");
  const [date, setDate] = useState(editSession?.date ?? todayISO());
  const [hours, setHours] = useState(editSession?.hours ?? 1);
  const [note, setNote] = useState(editSession?.note ?? "");
  const [weekGroupId, setWeekGroupId] = useState<string>(editSession?.weekGroupId ?? "");

  useEffect(() => {
    if (open) {
      setTrackId(editSession?.trackId ?? defaultTrackId ?? phase?.tracks[0]?.id ?? "");
      setDate(editSession?.date ?? todayISO());
      setHours(editSession?.hours ?? 1);
      setNote(editSession?.note ?? "");
      setWeekGroupId(editSession?.weekGroupId ?? "");
    }
  }, [open, defaultTrackId, phase, editSession]);

  const allTracks = useMemo(() => {
    const map = new Map<string, Track>();
    data.phases.forEach((p) => p.tracks.forEach((t) => map.set(t.id, t)));
    return Array.from(map.values());
  }, [data]);

  if (!phase) return null;

  const selectedTrack = allTracks.find((t) => t.id === trackId) ?? null;

  const save = () => {
    if (!trackId) {
      toast.error("Pick a track");
      return;
    }
    if (phase.startDate && date < phase.startDate) toast.warning("Date is before phase start");
    if (phase.endDate && date > phase.endDate) toast.warning("Date is after phase end");
    if (isEdit && editSession) {
      update((d) => ({
        ...d,
        sessions: d.sessions.map((s) =>
          s.id === editSession.id
            ? { ...s, trackId, date, hours, note, weekGroupId: weekGroupId || null }
            : s,
        ),
      }));
      toast.success("Session updated");
    } else {
      update((d) => ({
        ...d,
        sessions: [
          ...d.sessions,
          {
            id: uid(),
            trackId,
            phaseId: phase.id,
            date,
            hours,
            note,
            weekGroupId: weekGroupId || null,
          },
        ],
      }));
      toast.success(`Logged ${hours}h`);
    }
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Session" : "Log Session"}>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-[var(--color-muted-foreground)]">Track</label>
          <select className="input-base mt-1" value={trackId} onChange={(e) => setTrackId(e.target.value)}>
            {allTracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.icon} {t.name}
              </option>
            ))}
          </select>
        </div>
        {selectedTrack && selectedTrack.groups.length > 0 && (
          <div>
            <label className="text-xs text-[var(--color-muted-foreground)]">Week group (optional)</label>
            <select
              className="input-base mt-1"
              value={weekGroupId}
              onChange={(e) => setWeekGroupId(e.target.value)}
            >
              <option value="">— None —</option>
              {sortedGroups(selectedTrack).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>
        )}
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
          <button className="btn-ghost flex-1" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary flex-1" onClick={save}>
            Save
          </button>
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
  onReturnToDashboard,
}: {
  open: boolean;
  onClose: () => void;
  data: BootstrapData;
  update: (fn: (d: BootstrapData) => BootstrapData) => void;
  onReturnToDashboard?: () => void;
}) {
  const [name, setName] = useState("");
  const [start, setStart] = useState(todayISO());
  const [end, setEnd] = useState(todayISO());

  const setActive = (id: string) =>
    update((d) => ({ ...d, phases: d.phases.map((p) => ({ ...p, isActive: p.id === id })) }));

  const patchPhase = (id: string, patch: Partial<Phase>) =>
    update((d) => ({ ...d, phases: d.phases.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));

  const deletePhase = (p: Phase) => {
    if (!confirm("Are you sure you want to delete this phase? All tracks and sessions in it will be permanently removed.")) {
      return;
    }
    update((d) => ({
      ...d,
      phases: d.phases.filter((x) => x.id !== p.id),
      sessions: d.sessions.filter((s) => s.phaseId !== p.id),
    }));
    toast.success(`Deleted "${p.name}"`);
    onClose();
    onReturnToDashboard?.();
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
            <button className="btn-primary w-full" onClick={create}>
              Create phase
            </button>
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
                <div className="flex items-center justify-between gap-2">
                  <input
                    className="min-w-0 flex-1 bg-transparent font-semibold outline-none"
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
                  <button
                    className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-muted-foreground)] hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"
                    onClick={() => deletePhase(p)}
                    aria-label="Delete phase"
                  >
                    Delete
                  </button>
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
                <div className="mt-2 text-xs text-[var(--color-muted-foreground)]">
                  {p.tracks.length} tracks · {allSubtasks({ groups: p.tracks.flatMap((t) => t.groups ?? []) } as Track).length} tasks
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
