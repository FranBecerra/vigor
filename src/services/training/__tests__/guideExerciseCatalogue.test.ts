import guideData from '@/data/guide-exercises.json';
import { ExerciseGenerationTier, Equipment, MovementVector, MuscleGroup } from '@/models';
import { criteriaOf, EXERCISE_CATALOGUE, fatigueCost, filterCatalogue, stimulusQuality } from '@/services/training/exerciseCatalogue';
import { selectExercises } from '@/services/training/exerciseSelection';
import { TrainingGoal, buildVolumePlan } from '@/services/training/volumePlan';
import { ExperienceLevel } from '@/models/athlete';
import {
  GUIDE_EXISTING_IDS,
  buildGuideExercises,
  guideExerciseId,
} from '@/services/training/guideExerciseCatalogue';

describe('source guide exercise index', () => {
  it('matches explicitly described implements and the fixed-elbow shoulder-extension action', () => {
    const byPage = (page: number) => EXERCISE_CATALOGUE.find((e) => e.id === `guide-${page}`)!;
    expect(byPage(277).equipment).toBe(Equipment.STABILITY_BALL);
    expect(byPage(305).equipment).toBe(Equipment.BANDS);
    expect(byPage(311).equipment).toBe(Equipment.BANDS);
    expect(byPage(347).equipment).toBe(Equipment.BODYWEIGHT);
    expect(byPage(367).equipment).toBe(Equipment.BODYWEIGHT);
    expect(byPage(159).movementVector).toBe(MovementVector.SHOULDER_EXTENSION);
    expect([159, 277, 305, 311, 347, 367].every((p) =>
      byPage(p).generationTier === ExerciseGenerationTier.MANUAL_ONLY)).toBe(true);
  });
  it('retains every numbered exercise page, without a duplicated or blank entry', () => {
    expect(guideData.exercises).toHaveLength(337);
    expect(new Set(guideData.exercises.map((entry) => entry.page)).size).toBe(337);
    expect(guideData.exercises.every((entry) => entry.name.trim().length > 0)).toBe(true);
    expect(guideData.exercises[0].page).toBe(32);
    expect(guideData.exercises[guideData.exercises.length - 1].page).toBe(384);
  });

  it('links every page with bounded provisional scores or explicitly unscored manual status', () => {
    const ids = new Set(EXERCISE_CATALOGUE.map((exercise) => exercise.id));
    expect(ids.size).toBe(EXERCISE_CATALOGUE.length);
    guideData.exercises.forEach((entry) => {
      expect(ids.has(guideExerciseId(entry))).toBe(true);
    });
    const imported = EXERCISE_CATALOGUE.filter((exercise) =>
      exercise.guidePage !== undefined,
    );
    expect(imported).toHaveLength(337 - Object.keys(GUIDE_EXISTING_IDS).length);
    imported.forEach((exercise) => {
      if (exercise.guidePage! >= 197 && exercise.guidePage! <= 231) {
        expect(exercise.criteria).toBeUndefined();
        expect(exercise.generationTier).toBe(ExerciseGenerationTier.MANUAL_ONLY);
        return;
      }
      expect(exercise.criteria).toBeDefined();
      expect(exercise.secondaryMuscles).toEqual([]);
      expect(exercise.guidePage).toBeGreaterThanOrEqual(32);
      Object.values(criteriaOf(exercise)).forEach((score) => expect(score).toBeGreaterThanOrEqual(1));
      Object.values(criteriaOf(exercise)).forEach((score) => expect(score).toBeLessThanOrEqual(5));
      expect(stimulusQuality(exercise)).toBeGreaterThanOrEqual(1);
      expect(fatigueCost(exercise)).toBeGreaterThanOrEqual(1);
    });
  });

  it('classifies anatomically distinct source sections without treating forearms as biceps', () => {
    const byPage = (page: number) => EXERCISE_CATALOGUE.find((exercise) => exercise.id === `guide-${page}`)!;
    expect(byPage(144)).toMatchObject({ primaryMuscle: MuscleGroup.NECK, equipment: Equipment.TRAP_BAR });
    expect(byPage(146).movementVector).toBe(MovementVector.LOADED_CARRY);
    expect(byPage(220)).toMatchObject({ primaryMuscle: MuscleGroup.TRICEPS, equipment: Equipment.MACHINE });
    expect(byPage(262)).toMatchObject({ primaryMuscle: MuscleGroup.FOREARMS, movementVector: MovementVector.WRIST_EXTENSION });
    expect(byPage(267).movementVector).toBe(MovementVector.FOREARM_ROTATION);
    expect(byPage(320)).toMatchObject({ primaryMuscle: MuscleGroup.GLUTES, equipment: Equipment.CABLE });
    expect(byPage(384).movementVector).toBe(MovementVector.HIP_ADDUCTION);
    expect(byPage(286).movementVector).toBe(MovementVector.LOADED_CARRY);
    expect(byPage(299).movementVector).toBe(MovementVector.HIP_ABDUCTION);
    expect(byPage(102).primaryMuscle).toBe(MuscleGroup.MID_BACK);
    expect(byPage(119).primaryMuscle).toBe(MuscleGroup.LATS);
  });

  it('keeps page-scored but programming-unreviewed guide entries out of automatic selection', () => {
    const result = selectExercises({
      volumePlan: buildVolumePlan({ level: ExperienceLevel.INTERMEDIATE, goal: TrainingGoal.HYPERTROPHY }),
      catalogue: EXERCISE_CATALOGUE,
      seed: 27,
    });
    expect(result.selected.some((entry) => entry.exercise.generationTier === ExerciseGenerationTier.MANUAL_ONLY)).toBe(false);
  });

  it('infers the primary implement for all guide pages and respects equipment filters', () => {
    const imported = EXERCISE_CATALOGUE.filter((exercise) => exercise.guidePage !== undefined);
    expect(imported.every((exercise) => exercise.equipment !== Equipment.UNSPECIFIED)).toBe(true);
    const cable = EXERCISE_CATALOGUE.find((exercise) => exercise.id === 'guide-299')!;
    expect(cable.equipment).toBe(Equipment.CABLE);
    expect(filterCatalogue([cable], { availableEquipment: [] })).toEqual([]);
    expect(filterCatalogue([cable], { availableEquipment: [Equipment.CABLE] })).toEqual([cable]);
  });

  it('uses conservative ties and specific page exceptions instead of universal machine bonuses', () => {
    const byPage = (page: number) => EXERCISE_CATALOGUE.find((exercise) => exercise.id === `guide-${page}`)!;
    expect(criteriaOf(byPage(195)).resistanceProfileMatch).toBe(2);
    expect(criteriaOf(byPage(252)).stretchedPositionLoading).toBe(2);
    expect(criteriaOf(byPage(341)).rangeOfMotion).toBe(2);
    expect(criteriaOf(byPage(338)).stabilityCost).toBe(1);
    expect(criteriaOf(byPage(287)).loadProgressability).toBe(2);
    expect(criteriaOf(byPage(102)).stabilityCost).toBe(4);
    expect(criteriaOf(byPage(304)).systemicFatigueCost).toBe(4);
    expect(criteriaOf(byPage(110)).resistanceProfileMatch).toBe(3);
  });

  it('rejects duplicate source pages and broken links', () => {
    expect(() => buildGuideExercises([{ page: 500, name: 'Example' }, { page: 500, name: 'Example' }], [])).toThrow('Duplicate guide page');
    expect(() => buildGuideExercises([{ page: 33, name: 'Incline press' }], [])).toThrow('aliases missing exercise');
  });
});
