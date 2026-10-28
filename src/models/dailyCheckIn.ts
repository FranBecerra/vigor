/** Current subjective context; never a calculated readiness or retrospective review. */
export interface DailyCheckInAnswers {
  recovery?: 'WORSE' | 'USUAL' | 'BETTER';
  energy?: 'LOWER' | 'USUAL' | 'HIGHER';
  sleep?: 'WORSE' | 'USUAL' | 'BETTER';
  /** Kept separate from positive observations, not averaged into a score. */
  discomfort?: 'NONE' | 'PRESENT';
}

export interface DailyCheckIn {
  id: string;
  userId: string;
  questionnaireVersion: 1;
  localDate: string;
  /** JS convention: UTC minus local time, captured when the answer was updated. */
  timezoneOffsetMinutes: number;
  answers: DailyCheckInAnswers;
  createdAt: number;
  updatedAt: number;
}
