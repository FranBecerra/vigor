import type { CardioBlock, CardioCycleResponses, CardioProgression } from '@/models/cardioTraining';
import type { EasyCardioPrescription } from '@/models/cardio';

const answers = ['YES', 'NO', 'UNKNOWN'];
export const validCycleResponses = (v: unknown): v is CardioCycleResponses => {
  const r = v as CardioCycleResponses | null;
  return !!r && answers.includes(r.easy) && answers.includes(r.recovered) && ['NONE', 'PRESENT', 'UNKNOWN'].includes(r.symptoms);
};
export const positiveCycleResponses = (r: CardioCycleResponses) => r.easy === 'YES' && r.recovered === 'YES' && r.symptoms === 'NONE';

/** A deliberately small product step, not a validated injury-prevention threshold. */
export function nextEasyDurations(block: CardioBlock, previous: readonly number[], increase: boolean): number[] {
  const ceiling = Math.floor(block.proposal.input.sessionMinutes * 60);
  const room = Math.max(0, Math.floor(block.proposal.input.cardioMinutes * 60) - previous.reduce((n, s) => n + s, 0));
  const step = increase && previous.length ? Math.min(60, Math.floor(room / previous.length)) : 0;
  return previous.map(s => Math.max(s, Math.min(ceiling, s + step)));
}

/** Validate additive state without changing reconstruction of any legacy proposal. */
export function validCardioProgression(value: unknown, block: CardioBlock): value is CardioProgression {
  const p = value as CardioProgression | null;
  if (!p || p.policy !== 'REVIEWED_DURATION_V1' || !Array.isArray(p.reviews) || p.reviews.length > block.cycles) return false;
  let previous = block.proposal.preview.prescriptions.map(s => s.durationSeconds), at = block.createdAt;
  return Array.from(p.reviews).every((r, i) => {
    if (!r || r.cycle !== i || !Number.isSafeInteger(r.recordedAt) || r.recordedAt < at || r.recordedAt > block.updatedAt
      || !validCycleResponses(r.responses) || !['INCREASE', 'REPEAT'].includes(r.decision)
      || r.cycle === block.cycles - 1 && r.decision === 'INCREASE'
      || r.decision === 'INCREASE' && !positiveCycleResponses(r.responses)
      || !Array.isArray(r.nextSeconds)) return false;
    const expected = nextEasyDurations(block, previous, r.decision === 'INCREASE');
    if (r.nextSeconds.length !== expected.length || Array.from(r.nextSeconds).some((n, j) => n !== expected[j])) return false;
    previous = r.nextSeconds; at = r.recordedAt;
    return true;
  });
}

export function cardioCycleDoses(block: CardioBlock) {
  let seconds = block.proposal.preview.prescriptions.map(p => p.durationSeconds);
  const established = block.proposal.input.modalities.every(m => {
    const current = block.proposal.input.profile.modalities[m];
    return current?.status === 'REGULAR' && current.typicalSessionMinutes !== undefined;
  });
  return Array.from({ length: block.cycles }, (_, cycle) => {
    if (cycle > 0 && block.progression) seconds = block.progression.reviews[cycle - 1]?.nextSeconds
      ?? nextEasyDurations(block, seconds, established || cycle > 1);
    return { cycle, seconds: [...seconds], confirmed: !block.progression || cycle <= block.progression.reviews.length };
  });
}

/** Provisional future doses never become executable increases without a review. */
export function cardioSlotPrescription(block: CardioBlock, slotId: string, forecast = false): EasyCardioPrescription {
  const slot = block.slots.find(s => s.id === slotId);
  if (!slot) throw Error('invalidCardioSlot');
  const index = block.proposal.preview.prescriptions.findIndex(p => p.id === slot.prescriptionId);
  const base = block.proposal.preview.prescriptions[index];
  const cycle = !forecast && block.progression ? Math.min(slot.cycle, block.progression.reviews.length) : slot.cycle;
  const durationSeconds = cardioCycleDoses(block)[cycle].seconds[index];
  const edge = Math.min(300, Math.floor(durationSeconds * .2));
  return { ...base, policy: block.progression ? 'REVIEWED_EASY_DURATION_V1' : base.policy, adjustments: [...base.adjustments], durationSeconds,
    segments: base.segments.map((s, i) => ({ ...s, effort: { ...s.effort }, durationSeconds: i === 1 ? durationSeconds - edge * 2 : edge })) };
}
