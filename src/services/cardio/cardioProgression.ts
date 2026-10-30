import type { CardioBlock, CardioCycleResponses, CardioWorkout } from '@/models/cardioTraining';
import { validCardioBlock, dateInZone } from './cardioBlock';
import { validCardioWorkout } from './cardioWorkout';
import { cardioCycleDoses, nextEasyDurations, positiveCycleResponses, validCycleResponses } from './cardioProgressionPolicy';
import { shiftCalendarDate } from '@/services/training/trainingCalendar';
import { sessionEffortValue } from '@/services/training/sessionFeedback';

/** An explicit new-block policy; absence keeps legacy easy blocks frozen. */
export function withCardioProgression(block: CardioBlock): CardioBlock {
  if (!validCardioBlock(block, block?.userId) || block.progression || block.revision !== 1) throw Error('invalidCardioProgression');
  return { ...block, progression: { policy: 'REVIEWED_DURATION_V1', reviews: [] } };
}

export function reviewCardioCycle(block: CardioBlock, workouts: readonly CardioWorkout[], responses: CardioCycleResponses, now: number) {
  if (!validCardioBlock(block, block?.userId) || !block.progression || block.progression.reviews.length >= block.cycles || block.endedAt !== null || !validCycleResponses(responses)
    || !Number.isSafeInteger(now) || now < block.updatedAt || now > 8.64e15) throw Error('invalidCardioReview');
  const cycle = block.progression.reviews.length, slots = block.slots.filter(s => s.cycle === cycle);
  const candidates = workouts.filter(w => w?.userId === block.userId && w.blockId === block.id && w.status !== 'DISCARDED');
  const usable = (w: CardioWorkout) => validCardioWorkout(w, block.userId) && w.updatedAt <= now;
  const valid = candidates.every(usable), own = candidates.filter(usable);
  const records = slots.map(slot => own.filter(w => w.slotId === slot.id));
  const elapsed = dateInZone(now, block.timeZone) >= shiftCalendarDate(block.startDate, (cycle + 1) * block.proposal.input.cycleDays);
  const inProgress = own.some(w => w.status !== 'FINISHED' && slots.some(s => s.id === w.slotId));
  const nextStarted = own.some(w => block.slots.some(s => s.cycle === cycle + 1 && s.id === w.slotId));
  const current = cardioCycleDoses(block)[cycle].seconds;
  const reasons: Array<'PENDING' | 'INCOMPLETE' | 'UNKNOWN' | 'DIFFICULT' | 'SYMPTOMS' | 'NEXT_STARTED' | 'NO_FUTURE' | 'CAPACITY'> = [];
  if (!elapsed || inProgress || !valid) reasons.push('PENDING');
  if (!slots.length || slots.some((s, i) => {
    const index = block.proposal.preview.prescriptions.findIndex(p => p.id === s.prescriptionId);
    return s.disposition !== 'CARDIO' || records[i].length !== 1 || records[i][0].status !== 'FINISHED'
      || records[i][0].prescription.id !== s.prescriptionId || records[i][0].prescription.modality !== block.proposal.preview.prescriptions[index].modality
      || records[i][0].actualSeconds! < Math.max(current[index], records[i][0].prescription.durationSeconds);
  })) reasons.push('INCOMPLETE');
  if (responses.easy === 'UNKNOWN' || responses.recovered === 'UNKNOWN' || responses.symptoms === 'UNKNOWN') reasons.push('UNKNOWN');
  if (responses.easy === 'NO' || responses.recovered === 'NO' || own.some(w => {
    const effort = sessionEffortValue(w.feedback);
    return slots.some(s => s.id === w.slotId) && effort !== null && effort > 4;
  })) reasons.push('DIFFICULT');
  if (responses.symptoms === 'PRESENT') reasons.push('SYMPTOMS');
  if (nextStarted) reasons.push('NEXT_STARTED');
  if (cycle >= block.cycles - 1) reasons.push('NO_FUTURE');
  const increased = nextEasyDurations(block, current, true);
  if (increased.every((s, i) => s === current[i])) reasons.push('CAPACITY');
  const canIncrease = !reasons.length && positiveCycleResponses(responses);
  const ready = !reasons.some(r => ['PENDING', 'NEXT_STARTED'].includes(r));
  const fingerprint = JSON.stringify([block.revision, cycle, slots, responses, own.map(w => [w.id, w.revision, w.status, w.actualSeconds, w.feedback, w.prescription]).sort((a, b) => String(a[0]).localeCompare(String(b[0])))]);
  return { cycle, ready, canIncrease, reasons, current, next: canIncrease ? increased : [...current], fingerprint,
    completed: records.filter(rs => rs.some(w => w.status === 'FINISHED')).length, total: slots.length };
}

export function confirmCardioCycle(block: CardioBlock, workouts: readonly CardioWorkout[], responses: CardioCycleResponses,
  decision: 'INCREASE' | 'REPEAT', fingerprint: string, now: number): CardioBlock {
  const review = reviewCardioCycle(block, workouts, responses, now);
  if (!review.ready || review.fingerprint !== fingerprint || decision !== 'REPEAT' && decision !== 'INCREASE'
    || decision === 'INCREASE' && !review.canIncrease || block.revision === Number.MAX_SAFE_INTEGER) throw Error('staleCardioReview');
  const next: CardioBlock = { ...block, updatedAt: now, revision: block.revision + 1, progression: { policy: 'REVIEWED_DURATION_V1',
    reviews: [...block.progression!.reviews, { cycle: review.cycle, recordedAt: now, responses: { ...responses }, decision,
      nextSeconds: decision === 'INCREASE' ? review.next : review.current }] } };
  if (!validCardioBlock(next, block.userId)) throw Error('invalidCardioReview');
  return next;
}
