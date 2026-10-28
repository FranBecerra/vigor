/** Whole-session perception, shared by strength and future cardio records. Not set RIR or Borg CR10. */
export interface SessionEffortObservation {
  effort: number | null;
  recordedAt: number;
  timing: 'AT_FINISH' | 'HISTORY_EDIT' | 'MANUAL_ENTRY';
}

export interface SessionFeedback extends SessionEffortObservation {
  scale: 'VIGOR_SESSION_EFFORT_1_10_V1';
  /** Most recent 20 superseded answers; clearing an answer is an explicit revision. */
  revisions?: SessionEffortObservation[];
}
