import { SetType, type Mesocycle, type PlannedSession } from '@/models';
import { TrainingGoal } from '@/services/training/volumePlan';
import { EXERCISE_CATALOGUE } from '@/services/training/exerciseCatalogue';
import {
  baseSessionsForMicrocycle,
  changesForSessionEdit,
  resizeExerciseSets,
  replaceSessionExercise,
  sessionKey,
  sessionsForMicrocycle,
  withPlanRevision,
  withEstimatedWorkMinutes,
  withSessionOverride,
} from '@/services/training/mesocycleEditing';

const session: PlannedSession = {
  index: 0, focus: 'UPPER', estimatedWorkMinutes: 20,
  exercises: [{ exerciseId: 'curl', order: 0, isEdited: false,
    sets: [3, 3, 2, 1].map((targetRIR) => ({
      setType: SetType.NORMAL, targetReps: 12, targetRIR,
    })) }],
};
const mesocycle: Mesocycle = {
  id: 'm', userId: 'u', status: 'ACTIVE', plannedSessions: [session],
  targetVolumePerGroup: {}, currentMicrocycleIndex: 0,
  sessionsPerMicrocycle: 1, projectedMicrocycles: 6,
  startedAt: 1, updatedAt: 1,
};

describe('mesocycle editing', () => {
  it('resolves a future revision without rewriting previous microcycles', () => {
    const previous = sessionsForMicrocycle(mesocycle, TrainingGoal.HYPERTROPHY, 1);
    const changed = { ...previous[0], exercises: [{ ...previous[0].exercises[0],
      sets: previous[0].exercises[0].sets.map((set) => ({ ...set, targetReps: 15 })) }] };
    const revisions = withPlanRevision(mesocycle, 2, [changed]);
    const edited = { ...mesocycle, prescriptionRevisions: revisions };
    expect(sessionsForMicrocycle(edited, TrainingGoal.HYPERTROPHY, 1)).toEqual(previous);
    expect(baseSessionsForMicrocycle(edited, TrainingGoal.HYPERTROPHY, 2)[0]
      .exercises[0].sets[0].targetReps).toBe(15);
    expect(withPlanRevision(edited, 2, [session])).toHaveLength(1);
    expect(withPlanRevision({ ...edited, prescriptionRevisions: [
      ...revisions, { fromMicrocycleIndex: 4, plannedSessions: [session] },
    ] }, 1, [changed])).toEqual([{ fromMicrocycleIndex: 1, plannedSessions: [changed] }]);
    expect(mesocycle.prescriptionRevisions).toBeUndefined();
  });

  it('does not restart the strength intensity ramp after a future plan revision', () => {
    const strengthSession: PlannedSession = { ...session, exercises: [{
      ...session.exercises[0], strengthRole: 'MAIN',
    }] };
    const strengthMeso = { ...mesocycle, plannedSessions: [strengthSession] };
    const weekThree = sessionsForMicrocycle(strengthMeso, TrainingGoal.STRENGTH, 2);
    const edited = { ...strengthMeso, prescriptionRevisions:
      withPlanRevision(strengthMeso, 2, weekThree) };
    expect(sessionsForMicrocycle(edited, TrainingGoal.STRENGTH, 2)[0]
      .exercises[0].sets[0].targetRIR).toBe(2);
    expect(sessionsForMicrocycle(edited, TrainingGoal.STRENGTH, 4)[0]
      .exercises[0].sets[0].targetRIR).toBe(1);
  });

  it('applies a one-off override only to its own microcycle and session', () => {
    const altered = { ...session, exercises: [{ ...session.exercises[0], exerciseId: 'hammer' }] };
    const edited = { ...mesocycle, sessionOverrides: withSessionOverride(mesocycle, 3, altered) };
    expect(sessionsForMicrocycle(edited, TrainingGoal.HYPERTROPHY, 3)[0]
      .exercises[0].exerciseId).toBe('hammer');
    expect(sessionsForMicrocycle(edited, TrainingGoal.HYPERTROPHY, 2)[0]
      .exercises[0].exerciseId).toBe('curl');
    expect(sessionKey(3, 0)).toBe('3:0');
  });

  it('lets a session edit affect only this microcycle or all remaining ones', () => {
    const changed = { ...session, exercises: [{ ...session.exercises[0], exerciseId: 'hammer' }] };
    const oneOff = changesForSessionEdit(mesocycle, TrainingGoal.HYPERTROPHY, 1,
      changed, 'microcycle', false);
    expect(sessionsForMicrocycle({ ...mesocycle, ...oneOff }, TrainingGoal.HYPERTROPHY, 1)[0]
      .exercises[0].exerciseId).toBe('hammer');
    expect(sessionsForMicrocycle({ ...mesocycle, ...oneOff }, TrainingGoal.HYPERTROPHY, 2)[0]
      .exercises[0].exerciseId).toBe('curl');

    const remaining = changesForSessionEdit(mesocycle, TrainingGoal.HYPERTROPHY, 1,
      changed, 'remaining-mesocycle', false);
    expect(sessionsForMicrocycle({ ...mesocycle, ...remaining }, TrainingGoal.HYPERTROPHY, 1)[0]
      .exercises[0].exerciseId).toBe('hammer');
    expect(sessionsForMicrocycle({ ...mesocycle, ...remaining }, TrainingGoal.HYPERTROPHY, 3)[0]
      .exercises[0].exerciseId).toBe('hammer');
    expect(sessionsForMicrocycle({ ...mesocycle, ...remaining }, TrainingGoal.HYPERTROPHY, 0)[0]
      .exercises[0].exerciseId).toBe('curl');
  });

  it('preserves an already-partly-completed microcycle while carrying a pending edit forward', () => {
    const changed = { ...session, exercises: [{ ...session.exercises[0], exerciseId: 'hammer' }] };
    const patch = changesForSessionEdit(mesocycle, TrainingGoal.HYPERTROPHY, 2,
      changed, 'remaining-mesocycle', true);
    const edited = { ...mesocycle, ...patch };
    expect(sessionsForMicrocycle(edited, TrainingGoal.HYPERTROPHY, 1)[0]
      .exercises[0].exerciseId).toBe('curl');
    expect(sessionsForMicrocycle(edited, TrainingGoal.HYPERTROPHY, 2)[0]
      .exercises[0].exerciseId).toBe('hammer');
    expect(sessionsForMicrocycle(edited, TrainingGoal.HYPERTROPHY, 3)[0]
      .exercises[0].exerciseId).toBe('hammer');
    expect(patch.prescriptionRevisions?.[0].fromMicrocycleIndex).toBe(3);
  });

  it('does not let an older one-off override hide a newly applied remaining-plan edit', () => {
    const changed = { ...session, exercises: [{ ...session.exercises[0], exerciseId: 'hammer' }] };
    const earlier = { ...mesocycle, sessionOverrides: withSessionOverride(mesocycle, 2, session) };
    const patch = changesForSessionEdit(earlier, TrainingGoal.HYPERTROPHY, 2,
      changed, 'remaining-mesocycle', false);
    expect(patch.sessionOverrides?.['2:0']).toBeUndefined();
    expect(sessionsForMicrocycle({ ...earlier, ...patch }, TrainingGoal.HYPERTROPHY, 2)[0]
      .exercises[0].exerciseId).toBe('hammer');
    expect(changesForSessionEdit(mesocycle, TrainingGoal.HYPERTROPHY, 5,
      changed, 'remaining-mesocycle', true).prescriptionRevisions).toBeUndefined();
  });

  it('keeps another session unchanged when the remaining-plan scope is selected', () => {
    const other: PlannedSession = { ...session, index: 1, focus: 'PULL', exercises: [{
      ...session.exercises[0], exerciseId: 'row', order: 0,
    }] };
    const twoSessionMeso = { ...mesocycle, plannedSessions: [session, other],
      sessionsPerMicrocycle: 2 };
    const changed = { ...session, exercises: [{ ...session.exercises[0], exerciseId: 'hammer' }] };
    const patch = changesForSessionEdit(twoSessionMeso, TrainingGoal.HYPERTROPHY, 1,
      changed, 'remaining-mesocycle', false);
    expect(sessionsForMicrocycle({ ...twoSessionMeso, ...patch }, TrainingGoal.HYPERTROPHY, 3)
      .find((entry) => entry.index === 1)?.exercises[0].exerciseId).toBe('row');
  });

  it('resizes working sets without turning a heavy single into another set', () => {
    const exercise = { ...session.exercises[0], sets: [
      { setType: SetType.TOP_SINGLE, targetReps: 1, targetRIR: 2 },
      { setType: SetType.NORMAL, targetReps: 5, targetRIR: 3 },
    ] };
    const grown = resizeExerciseSets(exercise, 3);
    expect(grown.sets).toHaveLength(4);
    expect(grown.sets[0].setType).toBe(SetType.TOP_SINGLE);
    expect(grown.sets.slice(1).every((set) => set.setType === SetType.NORMAL)).toBe(true);
    expect(resizeExerciseSets(exercise, 0).sets).toHaveLength(2);
    expect(replaceSessionExercise(session, 'curl', grown).exercises[0].sets).toHaveLength(4);
    expect(session.exercises[0].sets).toHaveLength(4);
  });

  it('recalculates work duration after a one-off set-count edit', () => {
    const exercise = EXERCISE_CATALOGUE[0];
    const catalogue = new Map([[exercise.id, exercise]]);
    const planned = { ...session, exercises: [{ ...session.exercises[0], exerciseId: exercise.id }] };
    const before = withEstimatedWorkMinutes(planned, catalogue);
    const after = withEstimatedWorkMinutes({ ...planned, exercises: [
      resizeExerciseSets(planned.exercises[0], 6),
    ] }, catalogue);
    expect(after.estimatedWorkMinutes).toBeGreaterThan(before.estimatedWorkMinutes);
    expect(planned.estimatedWorkMinutes).toBe(20);
  });
});
