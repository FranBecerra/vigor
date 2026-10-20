import { Equipment, SetType, type Exercise, type Mesocycle, type PlannedSession, type Routine } from '@/models';
import { isValidCustomExercise } from './customExercises';
import { previewVolumeBreakdownByMuscle } from './previewEditing';
import { normalizeRoutineName } from './routineMapper';
import { exerciseMinutes, SESSION_OVERHEAD_MINUTES } from './trainingCapacity';
import { buildScheduleTemplate } from './scheduleTemplate';
import { TrainingGoal } from './volumePlan';

export function resizeManualSessions(sessions: readonly PlannedSession[], count: number): PlannedSession[] {
  if (!Number.isInteger(count) || count < 1 || count > 7) throw new Error('invalidSessions');
  return Array.from({ length: count }, (_, index) => sessions[index]
    ?? { index, focus: 'FULL_BODY', exercises: [], estimatedWorkMinutes: 0 });
}
export function timeManualSessions(sessions: readonly PlannedSession[], catalogue: ReadonlyMap<string, Exercise>): PlannedSession[] {
  return sessions.map((session) => ({ ...session, estimatedWorkMinutes: session.exercises.reduce((total, entry) => {
    const ex = entry.exerciseSnapshot ?? catalogue.get(entry.exerciseId);
    return total + (ex ? exerciseMinutes(ex, entry.sets.length, entry.restSeconds) : 0);
  }, 0) }));
}
export function manualRoutineDocuments(input: { userId: string; routineId: string; name: string; goal: TrainingGoal;
  microcycles: number; sessions: readonly PlannedSession[]; catalogue: ReadonlyMap<string, Exercise>; now: number;
  active: boolean; accentColor: string; automaticProgression?: boolean }): { routine: Routine; mesocycle: Mesocycle } {
  const name = normalizeRoutineName(input.name);
  if (!name) throw new Error('invalidName');
  if (!input.userId || !input.routineId || !Number.isFinite(input.now) || input.now < 0) throw new Error('invalidIdentity');
  if (!Object.values(TrainingGoal).includes(input.goal) || !Number.isInteger(input.microcycles)
    || input.microcycles < 1 || input.microcycles > 12) throw new Error('invalidMicrocycles');
  if (input.sessions.length < 1 || input.sessions.length > 7) throw new Error('invalidSessions');
  input.sessions.forEach((session, index) => {
    if (session.index !== index || !session.exercises.length || (session.name?.length ?? 0) > 60) throw new Error('emptySession');
    if (new Set(session.exercises.map((entry) => entry.exerciseId)).size !== session.exercises.length) throw new Error('duplicateExercise');
    if (new Set(session.exercises.map((entry) => entry.order)).size !== session.exercises.length) throw new Error('invalidPrescription');
    session.exercises.forEach((entry) => {
      const ex = entry.exerciseSnapshot ?? input.catalogue.get(entry.exerciseId);
      if (!ex || ex.id !== entry.exerciseId || (ex.isCustom && !isValidCustomExercise(ex, input.userId))) throw new Error('invalidExercise');
      if (!Number.isInteger(entry.order) || entry.order < 0) throw new Error('invalidPrescription');
      if (!entry.sets.length || entry.sets.length > 30) throw new Error('invalidPrescription');
      if (entry.restSeconds !== undefined && (!Number.isFinite(entry.restSeconds) || entry.restSeconds < 0 || entry.restSeconds > 3600)) throw new Error('invalidPrescription');
      entry.sets.forEach((set) => {
        const timed = ex.recording?.measure === 'SECONDS';
        const lower = timed ? set.targetDurationSeconds : set.targetRepsMin ?? set.targetReps;
        const upper = timed ? set.targetDurationSeconds : set.targetReps;
        if (!Number.isInteger(lower) || !Number.isInteger(upper) || lower! < 1 || lower! > upper!
          || upper! > (timed ? 3600 : 100) || !Number.isInteger(set.targetRIR) || set.targetRIR < 0 || set.targetRIR > 5
          || !Object.values(SetType).includes(set.setType) || (set.targetWeightKg !== undefined
            && (!Number.isFinite(set.targetWeightKg) || set.targetWeightKg < 0))) throw new Error('invalidPrescription');
      });
    });
  });
  const sessions = JSON.parse(JSON.stringify(timeManualSessions(input.sessions, input.catalogue))) as PlannedSession[];
  const id = `${input.routineId}-m0`;
  const mesocycle: Mesocycle = { id, userId: input.userId, routineId: input.routineId, status: 'ACTIVE', prescriptionMode: input.automaticProgression ? 'AUTOMATIC' : 'MANUAL',
    plannedSessions: sessions, targetVolumePerGroup: Object.fromEntries(previewVolumeBreakdownByMuscle(sessions, input.catalogue).map((row) => [row.muscle, row.sets])),
    currentMicrocycleIndex: 0, projectedMicrocycles: input.microcycles, sessionsPerMicrocycle: sessions.length,
    scheduleTemplate: buildScheduleTemplate(sessions, input.catalogue), startedAt: input.now, updatedAt: input.now };
  const routine: Routine = { id: input.routineId, userId: input.userId, name, icon: 'barbell', accentColor: input.accentColor,
    activeMesocycleId: id, isActive: input.active, createdAt: input.now, updatedAt: input.now,
    generation: { creationMode: 'MANUAL', goal: input.goal, experienceLevel: 'UNSPECIFIED', split: 'MANUAL',
      sessionsPerMicrocycle: sessions.length, minutesPerSession: Math.ceil(Math.max(...sessions.map((session) => session.estimatedWorkMinutes)) + SESSION_OVERHEAD_MINUTES),
      availableEquipment: [...new Set(sessions.flatMap((session) => session.exercises.map((entry) =>
        (entry.exerciseSnapshot ?? input.catalogue.get(entry.exerciseId))?.equipment ?? Equipment.UNSPECIFIED)))],
      priorityRegions: [], deprioritizedRegions: [], vetoedExerciseIds: [], seed: 0 } };
  return { routine, mesocycle };
}
