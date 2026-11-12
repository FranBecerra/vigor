import type { CardioPlanningConstraints, CardioPlanCandidate } from '@/models/cardio';

export interface CardioAssignment { candidate: CardioPlanCandidate; dayIndex: number }

/** Circular gap cost, not a recovery threshold. A single workout has no pairwise gap. */
export function cardioGapCost(days: readonly number[], cycleDays: number): number {
  if (days.length < 2) return 0;
  const ordered = [...days].sort((a, b) => a - b);
  return ordered.reduce((sum, day, i) => {
    const gap = i + 1 === ordered.length ? ordered[0] + cycleDays - day : ordered[i + 1] - day;
    return sum + gap * gap;
  }, 0);
}

/** Strict lexicographic descent retains the incumbent on an exact tie. */
export function spacingRankIsBetter(next: readonly number[], previous: readonly number[]) {
  for (let i = 0; i < next.length; i++) if (next[i] !== previous[i]) return next[i] < previous[i];
  return false;
}

/** Requires the already-validated scheduling contract and accepted candidates. */
export function easySpacingRank(input: Pick<CardioPlanningConstraints, 'cycleDays' | 'fixedStrength'>, assigned: readonly CardioAssignment[]) {
  const days = assigned.map(a => a.dayIndex), active = new Set([...input.fixedStrength.map(s => s.dayIndex), ...days]);
  const distance = (a: number, b: number) => Math.min(Math.abs(a - b), input.cycleDays - Math.abs(a - b));
  const proximity = (a: number, b: number) => { const d = distance(a, b); return d === 0 ? 100 : d === 1 ? 40 : 0; };
  let overlap = 0, sharedDays = 0, sharedMinutes = 0;
  assigned.forEach((a, i) => {
    input.fixedStrength.forEach(s => {
      if (a.candidate.lowerBodyDemand === 'HIGH' && s.lowerBodyDemand === 'HIGH') overlap += proximity(a.dayIndex, s.dayIndex);
      if (a.dayIndex === s.dayIndex) { sharedDays++; sharedMinutes += s.estimatedMinutes ?? 0; }
    });
    if (a.candidate.lowerBodyDemand === 'HIGH') assigned.slice(i + 1).forEach(b => {
      if (b.candidate.lowerBodyDemand === 'HIGH') overlap += proximity(a.dayIndex, b.dayIndex);
    });
  });
  let longest = 0, run = 0, adjacent = 0;
  for (let day = 0; day < input.cycleDays * 2; day++) {
    run = active.has(day % input.cycleDays) ? Math.min(input.cycleDays, run + 1) : 0;
    longest = Math.max(longest, run);
    if (day < input.cycleDays && active.has(day) && active.has((day + 1) % input.cycleDays)) adjacent++;
  }
  return [overlap, days.length - new Set(days).size, sharedDays, longest, cardioGapCost(days, input.cycleDays), adjacent, sharedMinutes];
}

/**
 * Bounded local day moves/swaps for new easy previews only. Preserve every accepted
 * candidate, omission, dose and strength anchor. Never certify a global optimum.
 */
export function spreadEasyCardio(input: CardioPlanningConstraints, assigned: readonly CardioAssignment[]): CardioAssignment[] {
  if (!assigned.length || assigned.some(a => a.candidate.stimulus !== 'EASY')) return [...assigned];
  const strengthDays = new Set(input.fixedStrength.map(s => s.dayIndex));
  const strengthCount = new Map<number, number>();
  input.fixedStrength.forEach(s => strengthCount.set(s.dayIndex, (strengthCount.get(s.dayIndex) ?? 0) + 1));
  const feasible = (candidate: readonly CardioAssignment[]) => {
    const days = new Set(strengthDays), counts = new Map<number, number>();
    for (const a of candidate) {
      if (!input.availableDays.includes(a.dayIndex) || !a.candidate.candidateDays.includes(a.dayIndex)) return false;
      days.add(a.dayIndex); counts.set(a.dayIndex, (counts.get(a.dayIndex) ?? 0) + 1);
      if (!input.allowDoubles && (strengthDays.has(a.dayIndex) || counts.get(a.dayIndex)! > 1)
        || input.doublePolicy === 'STRENGTH_CARDIO_ONLY_V1' && (counts.get(a.dayIndex)! > 1 || (strengthCount.get(a.dayIndex) ?? 0) > 1)) return false;
    }
    return days.size <= input.maxActiveDays;
  };
  let best = [...assigned], rank = easySpacingRank(input, best), examined = 0;
  const consider = (candidate: CardioAssignment[]) => {
    examined++;
    if (!feasible(candidate)) return false;
    const next = easySpacingRank(input, candidate);
    if (!spacingRankIsBetter(next, rank)) return false;
    best = candidate; rank = next; return true;
  };
  // Keep synchronous preview work bounded; outer joint search yields separately.
  const passes = input.cycleDays <= 10 ? 2 : 1;
  for (let pass = 0; pass < passes && examined < 256; pass++) {
    let changed = false;
    for (let i = 0; i < best.length && examined < 256; i++) {
      for (const dayIndex of [...input.availableDays].sort((a, b) => a - b)) {
        if (examined >= 256) break;
        if (dayIndex !== best[i].dayIndex) changed = consider(best.map((a, index) => index === i ? { ...a, dayIndex } : a)) || changed;
      }
    }
    for (let i = 0; i < best.length && examined < 256; i++) for (let j = i + 1; j < best.length && examined < 256; j++) {
      const first = best[i].dayIndex, second = best[j].dayIndex;
      if (first !== second) changed = consider(best.map((a, index) => index === i ? { ...a, dayIndex: second } : index === j ? { ...a, dayIndex: first } : a)) || changed;
    }
    if (!changed) break;
  }
  return best;
}
