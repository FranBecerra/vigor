/**
 * Two-phase flow state for the generation screen (PRD §8.8). PURE LOGIC.
 *
 * WHY A PHASE INSTEAD OF A LONGER SCROLL
 *   The seven input groups still share one page, because session count and minutes
 *   move the set budget together and splitting them apart would hide that. The
 *   generated plan is not an eighth group: it is the RESULT of the other seven.
 *   Appending it to the same scroll meant the primary action produced no visible
 *   movement on the one tap that matters most, so the screen looked inert.
 *
 * WHY STALENESS IS A DECISION AND NOT A BOOLEAN FLAG ON THE PLAN
 *   Going back to re-read a setting must not cost the athlete their preview edits,
 *   so returning forward with untouched settings shows the plan already on screen
 *   instead of generating a new one. Once any setting moves, that plan no longer
 *   answers the question the settings ask, and the forward action becomes a
 *   regeneration. Those are different actions and the button says which one it is.
 */
import type { Equipment } from '@/models/biomechanics';
import type { ExperienceLevel, SplitStructure } from '@/models/athlete';
import type { TrainingGoal, VolumeRegion } from './volumePlan';

export type GenerationPhase = 'configure' | 'preview';

/** What the fixed primary button does right now. */
export type PrimaryAction = 'generate' | 'regenerate' | 'view' | 'save';

/** Every setting that changes what the generator produces. The seed is separate. */
export interface GenerationSettings {
  goal: TrainingGoal;
  level: ExperienceLevel;
  split: SplitStructure;
  sessionsPerMicrocycle: number;
  minutesPerSession: number;
  availableEquipment: readonly Equipment[];
  priorityRegions: readonly VolumeRegion[];
  deprioritizedRegions: readonly VolumeRegion[];
}

/**
 * Comparable form of the settings, for telling "the athlete changed something" from
 * "the athlete went back to look".
 *
 * The three lists are SORTED. That is not cosmetic: the generator reads all three as
 * membership tests (`filterCatalogue` builds a Set, the emphasis lookup uses
 * `includes`), so two orderings of the same members produce the same plan, and
 * toggling a chip off and on again must not read as a change.
 */
export function settingsSignature(settings: GenerationSettings): string {
  return [
    settings.goal,
    settings.level,
    settings.split,
    settings.sessionsPerMicrocycle,
    settings.minutesPerSession,
    [...settings.availableEquipment].sort().join(','),
    [...settings.priorityRegions].sort().join(','),
    [...settings.deprioritizedRegions].sort().join(','),
  ].join('|');
}

/** True when the plan on screen was generated from settings that have since moved. */
export function isPlanStale(
  planSignature: string | null,
  current: GenerationSettings,
): boolean {
  return planSignature !== null && planSignature !== settingsSignature(current);
}

export function primaryActionFor(input: {
  phase: GenerationPhase;
  hasPlan: boolean;
  stale: boolean;
}): PrimaryAction {
  if (input.phase === 'preview') return 'save';
  if (!input.hasPlan) return 'generate';
  return input.stale ? 'regenerate' : 'view';
}
