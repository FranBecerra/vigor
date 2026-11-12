import { MuscleGroup, Equipment, SetType, SplitStructure, type Exercise } from '@/models';
import { EXERCISE_CATALOGUE } from '@/services/training/exerciseCatalogue';
import { toRoutineView } from '@/services/training/routineView';
import { strengthPlacements, type CardioPreviewInput } from '@/services/cardio/cardioPreview';
import type { HybridSettings, HybridStrengthDraft } from '@/services/cardio/hybridAuthoring';

/** Fabricated prescriptions only; no repositories, Health or athlete reads. */
export function hybridFixture() {
  const routineId = 'hybrid-abcdefghijklmnopqrst', mesocycleId = `${routineId}-m0`;
  const exercises = new Map<string, Exercise>(EXERCISE_CATALOGUE.map(e => [e.id, e]));
  const draft: HybridStrengthDraft = {
    routine: { id: routineId, userId: 'owner', name: 'Hybrid foundation', icon: 'planet', accentColor: '#9BE317',
      activeMesocycleId: mesocycleId, isActive: false, createdAt: 1800000000000, updatedAt: 1800000000000,
      generation: { goal: 'HYPERTROPHY', experienceLevel: 'BEGINNER', split: SplitStructure.FULL_BODY, sessionsPerMicrocycle: 2,
        minutesPerSession: 45, availableEquipment: [Equipment.DUMBBELL], priorityRegions: [], deprioritizedRegions: [], vetoedExerciseIds: [], seed: 1 } },
    mesocycle: { id: mesocycleId, routineId, userId: 'owner', status: 'ACTIVE', targetVolumePerGroup: {}, currentMicrocycleIndex: 0,
      sessionsPerMicrocycle: 2, projectedMicrocycles: 4, startedAt: 1800000000000, updatedAt: 1800000000000,
      scheduleTemplate: { days: 8, slots: [{ kind: 'workout', sessionIndex: 0 }, { kind: 'rest' }, { kind: 'rest' }, { kind: 'rest' },
        { kind: 'workout', sessionIndex: 1 }, { kind: 'rest' }, { kind: 'rest' }, { kind: 'rest' }] },
      plannedSessions: [0, 1].map(index => ({ index, focus: 'FULL_BODY', estimatedWorkMinutes: 15, exercises: [{ exerciseId: EXERCISE_CATALOGUE[0].id, order: 0,
        isEdited: false, restSeconds: 120, sets: [0, 1, 2].map(() => ({ setType: SetType.NORMAL, targetReps: 10, targetRIR: 2 })) }] })) },
  };
  const labels = { focus: (s: string) => s, goal: (s: string) => s };
  const input: CardioPreviewInput = { placementPolicy: 'BALANCED_V2', modalities: ['CYCLING'], profile: { schemaVersion: 1, modalities: {} }, cycleDays: 8,
    availableDays: [0, 1, 2, 3, 4, 5, 6, 7], sessions: 2, cardioMinutes: 40, sessionMinutes: 20, maxActiveDays: 6, allowDoubles: false,
    strength: strengthPlacements(toRoutineView(draft.routine, draft.mesocycle, exercises, labels)!, true).sessions };
  const settings: HybridSettings = { priority: 'BALANCED', totalMinutesPerCycle: 360, maxSessionMinutes: 120 };
  return { draft, input, settings, exercises, labels };
}

export function hybridRunningFixture() {
  const f = hybridFixture(), sessions = f.draft.mesocycle.plannedSessions!;
  const quads = [...f.exercises.values()].find(e => e.primaryMuscle === MuscleGroup.QUADS)!;
  const template = sessions[0].exercises[0];
  const movement = (id: string, order: number, count: number) => ({ ...template, exerciseId: id, order,
    sets: Array.from({ length: count }, () => ({ setType: SetType.NORMAL, targetRIR: 2, targetReps: 10 })) });
  sessions[0].exercises = [movement(quads.id, 0, 4), ...[MuscleGroup.CHEST, MuscleGroup.BICEPS, MuscleGroup.TRICEPS]
    .map((muscle,i) => movement([...f.exercises.values()].find(e => e.primaryMuscle === muscle)!.id,i+1,3))];
  sessions[1].exercises = [movement(quads.id,0,2)];
  const input = { ...f.input, modalities: ['RUNNING' as const], sessions: 1, cardioMinutes: 20, availableDays: [0,1,4],
    strength: strengthPlacements(toRoutineView(f.draft.routine,f.draft.mesocycle,f.exercises,f.labels)!,true).sessions };
  return { ...f, input, sessions };
}
