/** Shared defaults for every entry point into the mesocycle generator. */
import { Equipment } from '@/models/biomechanics';
import { ExperienceLevel, SplitStructure } from '@/models/athlete';
import { TrainingGoal } from './volumePlan';

export const DEFAULT_GENERATOR_GOAL = TrainingGoal.HYPERTROPHY;
export const DEFAULT_GENERATOR_LEVEL = ExperienceLevel.INTERMEDIATE;
export const DEFAULT_GENERATOR_SESSIONS = 4;
export const DEFAULT_GENERATOR_MINUTES = 60;
export const DEFAULT_GENERATOR_SPLIT = SplitStructure.AUTO;

/** The commercial-gym preset shown as selected on the generation screen. */
export const DEFAULT_GENERATOR_EQUIPMENT: readonly Equipment[] = [
  Equipment.BARBELL,
  Equipment.DUMBBELL,
  Equipment.MACHINE,
  Equipment.CABLE,
  Equipment.BODYWEIGHT,
];
