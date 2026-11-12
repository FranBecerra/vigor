import { SplitStructure, type PlannedSession } from '@/models';
import { evaluateScheduleAlternative } from '../training/alternativeSchedule';
import { evaluateGeneratorQuality } from '../training/generatorQuality';
import { type MesocyclePlan, type MesocyclePlanInput } from '../training/mesocyclePlanner';
import { toPlannedSessions } from '../training/routineMapper';
import { distributeSelection, MIN_HYPERTROPHY_SESSION_SETS } from '../training/sessionDistribution';
import { SESSION_OVERHEAD_MINUTES } from '../training/trainingCapacity';
import { RegionEmphasis, TrainingGoal } from '../training/volumePlan';

export type HybridTemplate = { split: SplitStructure; sessions: PlannedSession[]; routineName?: string };

/** Redistribute the accepted exercise selection. Only AUTO authorizes comparing named splits. */
export function hybridTemplates(input: MesocyclePlanInput, original: MesocyclePlan): HybridTemplate[] {
  if (input.goal !== TrainingGoal.HYPERTROPHY || input.split !== SplitStructure.AUTO || !original.selection.performedSets) return [];
  const baseQuality = evaluateGeneratorQuality(input,original);
  if (!baseQuality.valid || original.distribution.unassigned.length) return [];
  const variants: HybridTemplate[] = [];
  const days = input.capacity.sessionsPerMicrocycle;
  for (const split of [SplitStructure.FULL_BODY, SplitStructure.UPPER_LOWER, SplitStructure.PUSH_PULL_LEGS_UPPER]) {
    if (split === SplitStructure.PUSH_PULL_LEGS_UPPER && days < 4) continue;
    const distribution = distributeSelection({ selection: original.selection, split, sessionsPerMicrocycle: days,
      capacityPacking: true, minimumSessionSets: MIN_HYPERTROPHY_SESSION_SETS,
      maxWorkMinutesPerSession: input.capacity.minutesPerSession - SESSION_OVERHEAD_MINUTES,
      deprioritizedMuscles: original.plan.muscles.filter(m => m.emphasis === RegionEmphasis.DEPRIORITIZED).map(m => m.muscle) });
    const candidate = { ...original, distribution, estimatedWorkMinutes: distribution.totalWorkMinutes,
      maxSessionWorkMinutes: distribution.maxSessionWorkMinutes };
    const quality = evaluateGeneratorQuality({ ...input, split }, candidate);
    // Strength-only rest placement is replaced by the actual combined calendar at review.
    const rejected = evaluateScheduleAlternative(input,original,candidate,quality,baseQuality)
      .some(reason => reason !== 'recovery-template' && reason !== 'cycle-duration');
    if (!rejected)
      variants.push({ split, sessions: toPlannedSessions(candidate,false,{ preserveFocus:true }) });
  }
  return variants;
}
