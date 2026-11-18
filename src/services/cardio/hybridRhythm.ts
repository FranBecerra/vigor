import { buildCardioPreview, cardioPreviewIssue, type CardioPreview, type CardioPreviewInput } from './cardioPreview';
import { cardioGapCost } from './cardioSpacing';
import type { HybridPriority } from './hybridAuthoring';

export class HybridRhythmCancelled extends Error {}

/** Reviewable relative-calendar heuristic, not a physiological recovery score. */
export function hybridRhythmQuality(input: CardioPreviewInput, preview: CardioPreview) {
  const distance = (a: number, b: number) => Math.min(Math.abs(a - b), input.cycleDays - Math.abs(a - b));
  const high = [...input.strength.filter(s => s.lowerBodyDemand === 'HIGH').map(s => s.dayIndex!),
    ...preview.scheduled.filter(s => s.lowerBodyDemand === 'HIGH').map(s => s.dayIndex)];
  let proximity = 0;
  high.forEach((day, i) => high.slice(i + 1).forEach(other => { const d = distance(day, other); proximity += d === 0 ? 100 : d === 1 ? 40 : 0; }));
  const active = new Set(preview.activeDays);
  let longestRun = 0, current = 0, adjacentActivePairs = 0;
  for (let i = 0; i < input.cycleDays * 2; i++) {
    current = active.has(i % input.cycleDays) ? Math.min(input.cycleDays, current + 1) : 0;
    longestRun = Math.max(longestRun, current);
    if (i < input.cycleDays && active.has(i) && active.has((i + 1) % input.cycleDays)) adjacentActivePairs++;
  }
  return { proximity, longestRun, adjacentActivePairs };
}
/** Lexicographic policy: later convenience cannot buy worse coverage or proximity; ties retain the original. */
export function hybridRhythmRankIsBetter(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < a.length; i++) { if (a[i] !== b[i]) return a[i] < b[i]; }
  return false;
}

/** Compare running and leg work across the cycle boundary as well as within it. */
export function hybridRunningProximity(input: CardioPreviewInput, preview: CardioPreview,
  legSets?: ReadonlyMap<string, number>, priority: HybridPriority = 'BALANCED') {
  let nearbySets = 0, beforeStrength = 0, beforeCardio = 0;
  for (const run of preview.scheduled) {
    if (run.modality !== 'RUNNING') continue;
    for (const session of input.strength) {
      if (session.dayIndex === undefined) continue;
      const sets = legSets?.get(session.id) ?? (legSets ? 0 : Number(session.lowerBodyDemand === 'HIGH'));
      const fromRun = (session.dayIndex - run.dayIndex + input.cycleDays) % input.cycleDays;
      if (fromRun === 0) {
        nearbySets += 2 * sets;
        beforeStrength += 2 * sets;
        beforeCardio += 2 * sets;
      } else if (fromRun === 1) {
        nearbySets += sets;
        beforeStrength += sets;
      } else if (fromRun === input.cycleDays - 1) {
        nearbySets += sets;
        beforeCardio += sets;
      }
    }
  }
  return { nearbySets, priorityCost: priority === 'STRENGTH' ? beforeStrength : priority === 'CARDIO' ? beforeCardio : 0 };
}

/**
 * Search only new, undated strength placements; never change dose, roster, within-strength order or actual dates.
 * Keep legacy saved preview reconstruction untouched. Every candidate still uses the existing scheduler.
 */
export async function suggestHybridRhythm(input: CardioPreviewInput, options: {
  legSets?: ReadonlyMap<string, number>;
  priority?: HybridPriority;
  isCancelled?: () => boolean; yieldControl?: () => Promise<void>;
} = {}) {
  if (cardioPreviewIssue(input) || input.strength.some((s, i) => !input.availableDays.includes(s.dayIndex!)
    || i > 0 && s.dayIndex! <= input.strength[i - 1].dayIndex!)) throw Error('invalidHybridRhythm');
  const check = () => { if (options.isCancelled?.()) throw new HybridRhythmCancelled(); };
  check();
  const initial = buildCardioPreview(input), original = input.strength.map(s => s.dayIndex!), available = [...input.availableDays].sort((a, b) => a - b);
  const quality = (candidate: CardioPreviewInput, preview: CardioPreview) => {
    const q = hybridRhythmQuality(candidate, preview);
    const duplicateCardio = preview.scheduled.length - new Set(preview.scheduled.map(s => s.dayIndex)).size;
    const sameDayLoad = preview.scheduled.reduce((sum, c) => sum + candidate.strength.filter(s => s.dayIndex === c.dayIndex).reduce((n, s) => n + s.estimatedMinutes, 0), 0);
    const sharedDays = preview.scheduled.filter(c => candidate.strength.some(s => s.dayIndex === c.dayIndex)).length;
    const running = hybridRunningProximity(candidate, preview, options.legSets, options.priority);
    return [preview.omitted.length, duplicateCardio, q.proximity, options.legSets ? running.nearbySets : 0, running.priorityCost,
      ...(input.spacingPolicy ? [sharedDays] : []), q.longestRun,
      ...(input.spacingPolicy ? [cardioGapCost(preview.scheduled.map(s => s.dayIndex), input.cycleDays)] : []), q.adjacentActivePairs, sameDayLoad,
      candidate.strength.reduce((sum, s, i) => sum + Math.abs(s.dayIndex! - original[i]), 0)];
  };
  let bestInput = input, bestPreview = initial, bestScore = quality(input, initial), examined = 1;
  const seen = new Set([original.join(',')]), queue: number[][] = [];
  const enqueue = (days: number[]) => { const key = days.join(','); if (!seen.has(key)) { seen.add(key); queue.push(days); } };
  const neighbors = (days: number[]) => days.forEach((_, i) => available.forEach(day => {
    if ((i === 0 || day > days[i - 1]) && (i === days.length - 1 || day < days[i + 1])) enqueue(days.map((old, j) => i === j ? day : old));
  }));
  if (input.strength.length && input.cycleDays <= 10) {
    const enumerate = (start: number, days: number[]) => {
      if (days.length === original.length) { enqueue(days); return; }
      for (let i = start; i <= available.length - (original.length - days.length); i++) enumerate(i + 1, [...days, available[i]]);
    };
    enumerate(0, []);
  } else if (input.strength.length) {
    // Bounded seeds and local refinement for longer cycles, not an unbounded combinatorial search.
    for (let offset = 0; offset < available.length; offset++) {
      enqueue(original.map((_, i) => available[(Math.floor(i * available.length / original.length) + offset) % available.length]).sort((a, b) => a - b));
    }
    neighbors(original);
  }
  const limit = input.cycleDays <= 10 ? 300 : 128;
  for (let cursor = 0; cursor < queue.length && examined < limit; cursor++) {
    check();
    if (examined % 8 === 0) {
      await (options.yieldControl?.() ?? new Promise<void>(resolve => setTimeout(resolve, 0))); check();
    }
    const days = queue[cursor], candidate = { ...input, strength: input.strength.map((s, i) => ({ ...s, dayIndex: days[i] })) };
    const preview = buildCardioPreview(candidate), score = quality(candidate, preview); examined++;
    if (hybridRhythmRankIsBetter(score, bestScore)) {
      bestInput = candidate; bestPreview = preview; bestScore = score;
      if (input.cycleDays > 10) neighbors(days);
    }
  }
  check();
  return { input: bestInput, preview: bestPreview, changed: bestInput !== input, examined,
    before: hybridRhythmQuality(input, initial), after: hybridRhythmQuality(bestInput, bestPreview) };
}
