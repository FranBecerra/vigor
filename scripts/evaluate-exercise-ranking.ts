/** Reproducible paired selection audit: 30 hypertrophy inputs plus a strength control. */
import { Equipment, SplitStructure } from '../src/models';
import { ExperienceLevel } from '../src/models/athlete';
import { EXERCISE_CATALOGUE, filterCatalogue } from '../src/services/training/exerciseCatalogue';
import { planMesocycle } from '../src/services/training/mesocyclePlanner';
import { TrainingGoal, VolumeRegion } from '../src/services/training/volumePlan';

export const cases = [
  { id: 'A', level: ExperienceLevel.INTERMEDIATE, sessions: 4, minutes: 75, split: SplitStructure.AUTO, seed: 11, priority: [VolumeRegion.BACK, VolumeRegion.TRICEPS], deprioritized: [VolumeRegion.QUADS] },
  { id: 'B', level: ExperienceLevel.INTERMEDIATE, sessions: 4, minutes: 75, split: SplitStructure.AUTO, seed: 42, priority: [VolumeRegion.BACK, VolumeRegion.TRICEPS], deprioritized: [VolumeRegion.QUADS] },
  { id: 'C', level: ExperienceLevel.INTERMEDIATE, sessions: 5, minutes: 65, split: SplitStructure.AUTO, seed: 7 },
  { id: 'D', level: ExperienceLevel.INTERMEDIATE, sessions: 5, minutes: 65, split: SplitStructure.AUTO, seed: 21 },
  { id: 'E', level: ExperienceLevel.INTERMEDIATE, sessions: 4, minutes: 70, split: SplitStructure.PUSH_PULL_LEGS, seed: 13, priority: [VolumeRegion.BICEPS] },
  { id: 'F', level: ExperienceLevel.BEGINNER, sessions: 3, minutes: 60, split: SplitStructure.FULL_BODY, seed: 5 },
  { id: 'G', level: ExperienceLevel.ADVANCED, sessions: 6, minutes: 75, split: SplitStructure.PUSH_PULL_LEGS, seed: 19 },
  { id: 'H', level: ExperienceLevel.ADVANCED, sessions: 5, minutes: 70, split: SplitStructure.UPPER_LOWER, seed: 17, priority: [VolumeRegion.HAMSTRINGS, VolumeRegion.DELTS_LATERAL], deprioritized: [VolumeRegion.CHEST] },
  { id: 'I', level: ExperienceLevel.INTERMEDIATE, sessions: 4, minutes: 60, split: SplitStructure.AUTO, seed: 31, equipment: [Equipment.BARBELL, Equipment.DUMBBELL, Equipment.BODYWEIGHT] },
  { id: 'J', level: ExperienceLevel.INTERMEDIATE, sessions: 4, minutes: 75, split: SplitStructure.AUTO, seed: 9, goal: TrainingGoal.STRENGTH },
  { id: 'K', level: ExperienceLevel.BEGINNER, sessions: 2, minutes: 45, split: SplitStructure.AUTO, seed: 2 },
  { id: 'L', level: ExperienceLevel.BEGINNER, sessions: 3, minutes: 45, split: SplitStructure.FULL_BODY, seed: 23, priority: [VolumeRegion.BACK] },
  { id: 'M', level: ExperienceLevel.BEGINNER, sessions: 3, minutes: 75, split: SplitStructure.AUTO, seed: 34, priority: [VolumeRegion.CHEST], deprioritized: [VolumeRegion.QUADS] },
  { id: 'N', level: ExperienceLevel.BEGINNER, sessions: 4, minutes: 55, split: SplitStructure.UPPER_LOWER, seed: 8 },
  { id: 'O', level: ExperienceLevel.BEGINNER, sessions: 4, minutes: 70, split: SplitStructure.AUTO, seed: 51, priority: [VolumeRegion.HAMSTRINGS] },
  { id: 'P', level: ExperienceLevel.BEGINNER, sessions: 3, minutes: 60, split: SplitStructure.FULL_BODY, seed: 29, equipment: [Equipment.BARBELL, Equipment.DUMBBELL, Equipment.BODYWEIGHT] },
  { id: 'Q', level: ExperienceLevel.BEGINNER, sessions: 4, minutes: 45, split: SplitStructure.PUSH_PULL_LEGS, seed: 61, priority: [VolumeRegion.BICEPS] },
  { id: 'R', level: ExperienceLevel.BEGINNER, sessions: 2, minutes: 80, split: SplitStructure.FULL_BODY, seed: 16, deprioritized: [VolumeRegion.CHEST] },
  { id: 'S', level: ExperienceLevel.BEGINNER, sessions: 5, minutes: 50, split: SplitStructure.AUTO, seed: 74, priority: [VolumeRegion.GLUTES] },
  { id: 'T', level: ExperienceLevel.INTERMEDIATE, sessions: 3, minutes: 45, split: SplitStructure.FULL_BODY, seed: 6 },
  { id: 'U', level: ExperienceLevel.INTERMEDIATE, sessions: 4, minutes: 90, split: SplitStructure.UPPER_LOWER, seed: 25, priority: [VolumeRegion.CHEST] },
  { id: 'V', level: ExperienceLevel.INTERMEDIATE, sessions: 5, minutes: 55, split: SplitStructure.PUSH_PULL_LEGS, seed: 38, priority: [VolumeRegion.QUADS] },
  { id: 'W', level: ExperienceLevel.INTERMEDIATE, sessions: 6, minutes: 60, split: SplitStructure.AUTO, seed: 48, deprioritized: [VolumeRegion.BICEPS] },
  { id: 'X', level: ExperienceLevel.ADVANCED, sessions: 3, minutes: 60, split: SplitStructure.FULL_BODY, seed: 12 },
  { id: 'Y', level: ExperienceLevel.ADVANCED, sessions: 4, minutes: 75, split: SplitStructure.UPPER_LOWER, seed: 30, priority: [VolumeRegion.BACK] },
  { id: 'Z', level: ExperienceLevel.ADVANCED, sessions: 5, minutes: 65, split: SplitStructure.AUTO, seed: 41, priority: [VolumeRegion.TRICEPS], deprioritized: [VolumeRegion.HAMSTRINGS] },
  { id: 'AA', level: ExperienceLevel.ADVANCED, sessions: 6, minutes: 45, split: SplitStructure.PUSH_PULL_LEGS, seed: 59 },
  { id: 'AB', level: ExperienceLevel.ADVANCED, sessions: 4, minutes: 90, split: SplitStructure.AUTO, seed: 71, priority: [VolumeRegion.QUADS] },
  { id: 'AC', level: ExperienceLevel.ADVANCED, sessions: 5, minutes: 80, split: SplitStructure.UPPER_LOWER, seed: 88, priority: [VolumeRegion.BICEPS, VolumeRegion.DELTS_LATERAL] },
  { id: 'AD', level: ExperienceLevel.ADVANCED, sessions: 6, minutes: 60, split: SplitStructure.AUTO, seed: 95, equipment: [Equipment.BARBELL, Equipment.DUMBBELL, Equipment.BODYWEIGHT] },
  { id: 'AE', level: ExperienceLevel.ADVANCED, sessions: 5, minutes: 75, split: SplitStructure.PUSH_PULL_LEGS, seed: 101, deprioritized: [VolumeRegion.CHEST] },
] as const;

for (const level of Object.values(ExperienceLevel)) {
  const levelCases = cases.filter((scenario) => scenario.level === level && scenario.id !== 'J');
  if (levelCases.length !== 10) throw new Error(`Expected 10 hypertrophy cases for ${level}`);
}
if (new Set(cases.map(({ id }) => id)).size !== cases.length) {
  throw new Error('Scenario IDs must be unique');
}

if (process.argv[1]?.endsWith('evaluate-exercise-ranking.ts')) {
const policy = process.argv.includes('--legacy') ? 'legacy-weighted' : 'ordinal';
const levelFilter = process.argv.find((arg: string) => arg.startsWith('--level='))?.split('=')[1];
const reports = cases.filter((scenario) => !levelFilter || scenario.level === levelFilter).map((scenario) => {
  const catalogue = 'equipment' in scenario
    ? filterCatalogue(EXERCISE_CATALOGUE, { availableEquipment: scenario.equipment })
    : EXERCISE_CATALOGUE;
  const result = planMesocycle({
    level: scenario.level,
    goal: 'goal' in scenario ? scenario.goal : TrainingGoal.HYPERTROPHY,
    capacity: { sessionsPerMicrocycle: scenario.sessions, minutesPerSession: scenario.minutes },
    split: scenario.split,
    seed: scenario.seed,
    rankingPolicy: policy,
    catalogue,
    priorityRegions: 'priority' in scenario ? scenario.priority : [],
    deprioritizedRegions: 'deprioritized' in scenario ? scenario.deprioritized : [],
  });
  return {
    id: scenario.id,
    input: scenario,
    limitedBy: result.limitedBy,
    squeeze: result.squeeze,
    executedSets: result.selection.performedSets,
    attributedSets: result.selection.attributedSets,
    unassigned: result.distribution.unassigned.length,
    warnings: result.distribution.structureWarnings.map((warning) => `${warning.kind}:${warning.muscle ?? warning.sessionIndex ?? ''}`),
    sequencingWarnings: result.distribution.sequencingWarnings.length,
    sequencing: result.distribution.sequencingWarnings.map((warning) => ({
      from: warning.precedingSessionIndex,
      to: warning.followingSessionIndex,
      muscles: warning.sharedMuscles,
      sameVector: warning.sharesMovementVector,
    })),
    sessions: result.distribution.sessions.map((session) => ({
      focus: session.focus,
      minutes: Math.round(session.estimatedWorkMinutes),
      sets: session.exercises.reduce((total, item) => total + item.sets, 0),
      exercises: session.exercises.map(({ exercise, sets }) => ({
        id: exercise.id, name: exercise.name, muscle: exercise.primaryMuscle,
        vector: exercise.movementVector, sets,
      })),
    })),
  };
});

const counts: Record<string, number> = {};
reports.filter((report) => report.input.id !== 'J').forEach((report) => {
  new Set(report.sessions.flatMap((session) => session.exercises.map(({ id }) => id)))
    .forEach((id) => { counts[id] = (counts[id] ?? 0) + 1; });
});
console.log(JSON.stringify({ policy, reports, counts }));
}
