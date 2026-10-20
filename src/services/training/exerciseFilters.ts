import { Equipment, MuscleGroup, type Exercise } from '@/models';
import { primaryMusclesOf } from './exerciseMuscles';

export const EXERCISE_EQUIPMENT_FILTERS = ['ALL', 'FREE_WEIGHTS', 'MACHINES', 'BODYWEIGHT', 'BANDS', 'OTHER'] as const;
export type ExerciseEquipmentFilter = typeof EXERCISE_EQUIPMENT_FILTERS[number];
const free = new Set([Equipment.BARBELL, Equipment.DUMBBELL, Equipment.SAFETY_BAR, Equipment.TRAP_BAR, Equipment.LANDMINE, Equipment.KETTLEBELL]);
const machines = new Set([Equipment.MACHINE, Equipment.SMITH_MACHINE, Equipment.CABLE]);
export function equipmentCategory(equipment: Equipment): Exclude<ExerciseEquipmentFilter, 'ALL'> {
  if (free.has(equipment)) return 'FREE_WEIGHTS';
  if (machines.has(equipment)) return 'MACHINES';
  if (equipment === Equipment.BODYWEIGHT) return 'BODYWEIGHT';
  if (equipment === Equipment.BANDS) return 'BANDS';
  return 'OTHER';
}
/** Filters direct targets, including co-primaries; text search remains a separate intersection. */
export function filterExercisePicker(exercises: readonly Exercise[], muscle: MuscleGroup | null,
  equipment: ExerciseEquipmentFilter): Exercise[] {
  return exercises.filter((exercise) => exercise.archivedAt === undefined
    && (equipment === 'ALL' || equipmentCategory(exercise.equipment) === equipment)
    && (muscle === null || (muscle === MuscleGroup.UNCLASSIFIED ? primaryMusclesOf(exercise).length === 0
      : primaryMusclesOf(exercise).includes(muscle))));
}
