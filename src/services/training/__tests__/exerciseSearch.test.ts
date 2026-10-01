import {
  normalizeExerciseSearch,
  partitionSwapCandidates,
  searchExercises,
} from '@/services/training/exerciseSearch';
import {
  Equipment,
  ExerciseProfile,
  MovementVector,
  MuscleGroup,
  type Exercise,
} from '@/models';
import { EXERCISE_CATALOGUE } from '../exerciseCatalogue';

function exercise(id: string, name: string, primaryMuscle: MuscleGroup): Exercise {
  return {
    id,
    name,
    primaryMuscle,
    secondaryMuscles: [],
    movementVector: MovementVector.PULL_HORIZONTAL,
    profile: ExerciseProfile.ISOLATION,
    equipment: Equipment.CABLE,
    isCustom: false,
  };
}

const shoulder = exercise('lateral', 'Elevación lateral', MuscleGroup.DELTS_LATERAL);
const lat = exercise('pulldown', 'Jalón unilateral', MuscleGroup.LATS);
const midBack = exercise('row', 'Retracción escapular', MuscleGroup.MID_BACK);
const chest = exercise('press', 'Press convergente', MuscleGroup.CHEST);
const catalogue = [shoulder, lat, midBack, chest];
const label = (muscle: MuscleGroup) => muscle;

describe('exercise search', () => {
  it('finds the added JM variants and the Kaz alias', () => {
    expect(searchExercises('JM Press', EXERCISE_CATALOGUE, label).map((e) => e.id))
      .toEqual(expect.arrayContaining(['guide-211', 'guide-210']));
    expect(searchExercises('Kaz', EXERCISE_CATALOGUE, label).map((e) => e.id)).toContain('guide-210');
  });
  it('normalizes case and accents', () => {
    expect(normalizeExerciseSearch('  BÍceps  ')).toBe('biceps');
  });

  it('finds every deltoid from a partial synonym', () => {
    expect(searchExercises('delt', catalogue, label).map((item) => item.id)).toEqual(['lateral']);
  });

  it('maps the broad back synonym to lats and mid back', () => {
    expect(searchExercises('espalda', catalogue, label).map((item) => item.id)).toEqual([
      'pulldown',
      'row',
    ]);
  });

  it('keeps ordinary exercise-name search and empty search', () => {
    expect(searchExercises('convergente', catalogue, label)).toEqual([chest]);
    expect(searchExercises('  ', catalogue, label)).toEqual(catalogue);
  });

  it('separates same-primary-muscle alternatives from the rest without reordering', () => {
    const current = exercise('current', 'Remo actual', MuscleGroup.MID_BACK);
    const secondRow = exercise('row-2', 'Remo alternativo', MuscleGroup.MID_BACK);
    expect(partitionSwapCandidates(current, [lat, secondRow, chest])).toEqual({
      related: [secondRow],
      other: [lat, chest],
    });
  });
});
