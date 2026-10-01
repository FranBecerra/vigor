/**
 * Emphasis selection state for the generation screen. PURE LOGIC.
 *
 * WHY THIS IS SEPARATE FROM `assertEmphasisLimits`
 *   That function THROWS, on purpose: reaching it with an illegal combination is a
 *   programming error, because the screen is supposed to prevent the fourth tap.
 *   But a screen cannot prevent a tap it only learns about by catching an
 *   exception. It needs to know, BEFORE rendering, which regions are still
 *   affordable, so an unaffordable one renders disabled instead of throwing when
 *   pressed.
 *
 *   So the rule lives in one place (`volumePlan`) and this module answers the
 *   question the UI actually asks: what can still be picked, and how much budget
 *   is left. It never throws.
 *
 * THE BUDGET, RESTATED
 *   Priorities cost SLOTS, not headcount, because what limits them is recovery:
 *   an expensive region takes a whole slot and a cheap one half. Two slots total,
 *   with a hard cap of three regions so that six cheap ones cannot add up to a plan
 *   with no priorities at all (§3.3).
 */
import {
  LOW_COST_REGIONS,
  MAX_PRIORITY_REGIONS,
  PRIORITY_SLOT_BUDGET,
  prioritySlotsOf,
  VolumeRegion,
} from './volumePlan';

/** Which list a region currently sits in. */
export type EmphasisChoice = 'PRIORITY' | 'NORMAL' | 'DEPRIORITIZED';

export interface EmphasisSelection {
  priority: readonly VolumeRegion[];
  deprioritized: readonly VolumeRegion[];
}

export const EMPTY_EMPHASIS: EmphasisSelection = { priority: [], deprioritized: [] };

/**
 * Regions exposed by the standard generator. Tibialis remains in the domain
 * model for custom programming and rehabilitation, but is too granular for the
 * primary mesocycle-emphasis control.
 */
export const GENERATOR_EMPHASIS_REGIONS: readonly VolumeRegion[] = Object.values(
  VolumeRegion,
).filter((region) => region !== VolumeRegion.TIBIALIS && region !== VolumeRegion.FOREARMS);

/** Slots the current priorities consume. */
export function usedSlots(selection: EmphasisSelection): number {
  return selection.priority.reduce((sum, region) => sum + prioritySlotsOf(region), 0);
}

/** Slots still available. Never negative. */
export function remainingSlots(selection: EmphasisSelection): number {
  return Math.max(0, PRIORITY_SLOT_BUDGET - usedSlots(selection));
}

export function choiceOf(
  selection: EmphasisSelection,
  region: VolumeRegion,
): EmphasisChoice {
  if (selection.priority.includes(region)) return 'PRIORITY';
  if (selection.deprioritized.includes(region)) return 'DEPRIORITIZED';
  return 'NORMAL';
}

/** True when the region is cheap to recover from, so it costs half a slot. */
export function isLowCost(region: VolumeRegion): boolean {
  return LOW_COST_REGIONS.includes(region);
}

/**
 * Whether the region could be prioritised right now.
 *
 * A region already prioritised returns true: the control stays enabled so tapping
 * it can DESELECT. Only an unaffordable addition is refused.
 */
export function canPrioritize(
  selection: EmphasisSelection,
  region: VolumeRegion,
): boolean {
  if (selection.priority.includes(region)) return true;
  if (selection.priority.length >= MAX_PRIORITY_REGIONS) return false;
  return usedSlots(selection) + prioritySlotsOf(region) <= PRIORITY_SLOT_BUDGET;
}

/** Whether the region could be deprioritised right now. */
export function canDeprioritize(
  _selection: EmphasisSelection,
  _region: VolumeRegion,
): boolean {
  return true;
}

/**
 * Reason a region cannot be prioritised, for the screen to explain the block
 * instead of showing a dead control with no cause.
 *
 * Returns null when it can. `region-cap` and `slot-budget` are different messages
 * because they have different remedies: one needs a region freed, the other needs a
 * cheaper region.
 */
export function prioritizeBlockedReason(
  selection: EmphasisSelection,
  region: VolumeRegion,
): 'region-cap' | 'slot-budget' | null {
  if (canPrioritize(selection, region)) return null;
  if (selection.priority.length >= MAX_PRIORITY_REGIONS) return 'region-cap';
  return 'slot-budget';
}

/**
 * Applies a choice, returning a new selection.
 *
 * A region belongs to exactly one list, so setting it in one REMOVES it from the
 * other rather than leaving a contradiction for the service to catch. Choosing the
 * emphasis a region already has clears it back to normal, which is what makes a
 * three-state control tappable in one direction.
 *
 * An unaffordable priority is returned UNCHANGED instead of throwing: the control
 * should already be disabled, and silently succeeding would be worse than a no-op.
 */
export function withChoice(
  selection: EmphasisSelection,
  region: VolumeRegion,
  choice: EmphasisChoice,
): EmphasisSelection {
  const without = {
    priority: selection.priority.filter((entry) => entry !== region),
    deprioritized: selection.deprioritized.filter((entry) => entry !== region),
  };
  if (choice === 'NORMAL') return without;
  if (choice === 'PRIORITY') {
    if (!canPrioritize(selection, region)) return selection;
    return { ...without, priority: [...without.priority, region] };
  }
  return { ...without, deprioritized: [...without.deprioritized, region] };
}

/**
 * Advances a region through the three states, which is what a single tap does.
 *
 * Normal to priority to deprioritized and back. An unaffordable priority is SKIPPED
 * rather than blocking the cycle: tapping a region whose priority does not fit
 * should still let the athlete deprioritise it.
 */
export function cycleChoice(
  selection: EmphasisSelection,
  region: VolumeRegion,
): EmphasisSelection {
  const current = choiceOf(selection, region);
  if (current === 'NORMAL') {
    return canPrioritize(selection, region)
      ? withChoice(selection, region, 'PRIORITY')
      : withChoice(selection, region, 'DEPRIORITIZED');
  }
  if (current === 'PRIORITY') return withChoice(selection, region, 'DEPRIORITIZED');
  return withChoice(selection, region, 'NORMAL');
}
