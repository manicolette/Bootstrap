export type Subtask = {
  id: string;
  text: string;
  done: boolean;
  doneDate: string | null;
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
  endDate: string | null;
  completed: boolean;
  completedDate: string | null;
  completionType: CompletionType;
  notes: string;
  subtasks: Subtask[];
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
};

export type ArchivedTrack = {
  originalTrackData: Track;
  completedDate: string;
  completionType: Exclude<CompletionType, null>;
  phaseName: string;
};

export type BootstrapData = {
  phases: Phase[];
  sessions: Session[];
  archivedTracks: ArchivedTrack[];
};

export const emptyData = (): BootstrapData => ({
  phases: [],
  sessions: [],
  archivedTracks: [],
});
