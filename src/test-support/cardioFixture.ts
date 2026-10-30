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
