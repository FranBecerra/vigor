// User-selected presentation target, not a measured biological sleep requirement.
export const MIN_SLEEP_GOAL = 240;
export const MAX_SLEEP_GOAL = 720;
export const validSleepGoal = (value: unknown): value is number => typeof value === 'number'
  && Number.isInteger(value) && value >= MIN_SLEEP_GOAL && value <= MAX_SLEEP_GOAL;
