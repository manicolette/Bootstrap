export type Subtask = {
  id: string;
  text: string;
  done: boolean;
  doneDate: string | null;
  dueDate: string | null;
};

export type TaskGroup = {
  id: string;
  label: string;
  startDate: string | null;
  endDate: string | null;
  subtasks: Subtask[];
};

export type CompletionType = "proficient" | "certified" | "done" | null;

export type Track = {
  id: string;
  name: string;
  icon: string;
  description: string;
  hoursPerDay: number | null;
  hoursPerWeek: number | null;
  totalHoursGoal: number | null;
  startDate: string | null;
  endDate: string | null;
  completed: boolean;
  completedDate: string | null;
  completionType: CompletionType;
  notes: string;
  subtasks: Subtask[];
  groups: TaskGroup[];
};

export type Phase = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  tracks: Track[];
};

export type Session = {
  id: string;
  trackId: string;
  phaseId: string;
  date: string;
  hours: number;
  note: string;
  weekGroupId: string | null;
};

export type ArchivedTrack = {
  originalTrackData: Track;
  completedDate: string;
  completionType: Exclude<CompletionType, null>;
  phaseName: string;
  totalHours: number;
  totalSessions: number;
  finalNote: string;
};

export type BootstrapData = {
  phases: Phase[];
  sessions: Session[];
  archivedTracks: ArchivedTrack[];
  displayName: string;
};

export const emptyData = (): BootstrapData => ({
  phases: [],
  sessions: [],
  archivedTracks: [],
  displayName: "",
});
