/** Cross both goals with all levels, splits, emphases and equipment profiles. */
import { Equipment, ExperienceLevel, SplitStructure, type Exercise } from '../src/models';
import { filterCatalogue } from '../src/services/training/exerciseCatalogue';
import type { MesocyclePlanInput } from '../src/services/training/mesocyclePlanner';
import { TrainingGoal, VolumeRegion } from '../src/services/training/volumePlan';

export function crossedAuditCases(catalogue: readonly Exercise[]): { id: string; input: MesocyclePlanInput }[] {
  const emphases = [
    { id: 'balanced', priorityRegions: [], deprioritizedRegions: [] },
    { id: 'back-arms', priorityRegions: [VolumeRegion.BACK, VolumeRegion.TRICEPS], deprioritizedRegions: [VolumeRegion.QUADS] },
    { id: 'lower', priorityRegions: [VolumeRegion.GLUTES, VolumeRegion.HAMSTRINGS], deprioritizedRegions: [VolumeRegion.CHEST] },
  ];
  const equipment = [
    { id: 'full', catalogue },
    { id: 'free', catalogue: filterCatalogue(catalogue, { availableEquipment: [Equipment.BARBELL, Equipment.DUMBBELL, Equipment.BODYWEIGHT] }) },
    { id: 'no-barbell', catalogue: filterCatalogue(catalogue, { availableEquipment: [Equipment.DUMBBELL, Equipment.BODYWEIGHT] }) },
  ];
  return Object.values(TrainingGoal).flatMap((goal) => Object.values(ExperienceLevel).flatMap((level) =>
    Object.values(SplitStructure).flatMap((split) => emphases.flatMap((emphasis) => equipment.map((kit) => ({
      id: `cross-${goal}-${level}-${split}-${emphasis.id}-${kit.id}`,
      input: { level, goal, split, seed: 201,
        capacity: { sessionsPerMicrocycle: split === SplitStructure.FULL_BODY ? 3 : split === SplitStructure.PUSH_PULL_LEGS ? 5 : 4,
          minutesPerSession: goal === TrainingGoal.STRENGTH ? 90 : 75 },
        catalogue: kit.catalogue, priorityRegions: emphasis.priorityRegions, deprioritizedRegions: emphasis.deprioritizedRegions },
    }))))));
}

export function expandAuditCases(cases: { id: string; input: MesocyclePlanInput }[], seeds: number) {
  return cases.flatMap(({ id, input }) => [
    { id, input }, ...Array.from({ length: seeds - 1 }, (_, offset) => ({
      id: `${id}-seed${offset === 0 ? '' : `-${offset + 1}`}`, input: { ...input, seed: input.seed + offset + 1 },
    })), { id: `${id}-time`, input: { ...input, capacity: { ...input.capacity, minutesPerSession: input.capacity.minutesPerSession + 5 } } },
  ]);
}
