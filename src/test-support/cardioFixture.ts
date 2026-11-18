import { createLinkedCardioWorkout } from '@/services/cardio/cardioHealthLink';
import { saveCardioProposal } from '@/services/cardio/savedCardioPlan';
import { createCardioBlock } from '@/services/cardio/cardioBlock';
import type { CardioPreviewInput } from '@/services/cardio/cardioPreview';

/** Fabricated planning only; importing this module never touches an athlete store. */
export const CARDIO_FIXTURE_NOW = Date.UTC(2026, 9, 29, 12);
export function cardioFixture(input: Partial<CardioPreviewInput> = {}, at = CARDIO_FIXTURE_NOW) {
  const proposal = saveCardioProposal('proposal', 'owner', 'Easy foundation', {
    modalities: ['RUNNING'], profile: { schemaVersion: 1, modalities: {} }, cycleDays: 8,
    availableDays: [0, 1, 2, 3, 4, 5, 6, 7], sessions: 2, cardioMinutes: 60, sessionMinutes: 30,
    maxActiveDays: 5, allowDoubles: false, strength: [], ...input,
  }, input.strength?.length ? { routineId: 'r', fingerprint: 'synthetic',
    ...(input.placementPolicy ? { microcycleIndex: 0 } : {}) } : null, at);
  return createCardioBlock('block', proposal, '2026-10-29', 2, 'Europe/Madrid', at);
}

/** A weekly run linked before the next cycle opens on Monday. */
export function weeklyCardioAgendaFixture() {
  const now = Date.UTC(2026, 10, 15, 14);
  const original = cardioFixture({ cycleDays: 7, sessions: 1, availableDays: [0] }, Date.UTC(2026, 10, 9, 8));
  const [first, second] = original.slots;
  const block = { ...original, startDate: '2026-11-09', slots: [
    { ...first, date: '2026-11-09' }, { ...second, date: '2026-11-16' },
  ] };
  const monday = Date.UTC(2026, 10, 9, 12);
  const workout = createLinkedCardioWorkout(block, first.id, 'weekly-run', { version: 1, truncated: false, workouts: [{
    id: 'weekly-run', kind: 'RUNNING', start: monday, end: monday + 1800000, durationSeconds: 1800,
    linkKey: 'b'.repeat(64), sourceId: 'watch', sourceName: 'Watch', manuallyEntered: false, mixedActivities: false, ownExport: false,
  }] }, [], now, 'linked-weekly-run');
  return { now, today: '2026-11-15', block, workouts: [workout] };
}
