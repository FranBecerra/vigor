import { SetType, type Mesocycle, type WorkoutSession } from '@/models';
import type { MicrocycleReview } from '@/models/microcycleReview';
import { microcycleReviewId } from '@/services/bio/microcycleReview';
import { plannedSetId } from '@/services/training/plannedSessionRuntime';
import { sessionsForMicrocycle } from '@/services/training/mesocycleEditing';
import { hybridFixture } from './hybridFixture';

export function continuityFixture(now = Date.now()) {
  const { draft, exercises } = hybridFixture();
  const routine = { ...draft.routine, name: 'Strength foundation', isActive: true, updatedAt: now - 10 };
  const plannedSessions = draft.mesocycle.plannedSessions!.slice(0, 1).map(session => ({
    ...session, name: 'Full body', exercises: session.exercises.map(exercise => ({
      ...exercise, exerciseSnapshot: exercises.get(exercise.exerciseId),
      sets: exercise.sets.map(set => ({ ...set, targetRepsMin: 8 })),
    })),
  }));
  const source = { ...draft.mesocycle, plannedSessions, scheduleTemplate: undefined, sessionsPerMicrocycle: 1,
    startedAt: now - 14 * 86400000, updatedAt: now - 10, prescriptionMode: 'MANUAL' as NonNullable<Mesocycle['prescriptionMode']> };
  const exercise = plannedSessions[0].exercises[0];
  const history: WorkoutSession[] = [8, 8, 10, 10].map((actualReps, microcycleIndex) => {
    const completedAt = now - (10 - microcycleIndex * 2) * 86400000;
    return {
      id: `fixture-workout-${microcycleIndex}`, userId: source.userId, mesocycleId: source.id, microcycleId: `fixture-cycle-${microcycleIndex}`,
      microcycleIndex, plannedSessionIndex: 0, performedAt: completedAt - 60000, completedAt,
      exercises: [{ id: 'exercise', exerciseId: exercise.exerciseId, exerciseSnapshot: exercise.exerciseSnapshot, order: 0, isSwap: false,
        sets: exercise.sets.map((_, index) => ({ id: `set-${index}`, setType: SetType.NORMAL, targetRIR: 2, targetReps: 10, targetWeight: 25, isAutoFilled: false,
          actualWeight: 25, actualReps, actualRIR: 2, actualRIRSource: 'ATHLETE' as const })),
      }],
    };
  });
  return { data: { routine, source, history, priorHistory: [], now }, exercises };
}

export function continuityComparisonFixture() {
  const fixture = continuityFixture();
  const { data } = fixture;
  const session = data.source.plannedSessions[0];
  const planned = session.exercises[0];
  data.history = data.history.map(workout => ({ ...workout, exercises: workout.exercises.map(exercise => ({
    ...exercise, sets: exercise.sets.map((set, index) => ({ ...set,
      id: plannedSetId(session.index, planned.order, index), targetReps: planned.sets[index].targetReps,
      targetRIR: planned.sets[index].targetRIR,
      actualRIR: workout.microcycleIndex >= 2 && index > 0 ? 0 : planned.sets[index].targetRIR,
      actualRIRSource: workout.microcycleIndex === 0 ? 'INHERITED_TARGET' as const : 'ATHLETE' as const,
    })),
  })) }));
  const feedback: MicrocycleReview[] = data.history.slice(1).map(workout => ({
    id: microcycleReviewId(data.source.id, workout.microcycleIndex), userId: data.source.userId, mesocycleId: data.source.id,
    microcycleIndex: workout.microcycleIndex, questionnaireVersion: 1, status: 'SUBMITTED',
    answers: { recovery: workout.microcycleIndex >= 2 ? 'WORSE' : 'USUAL' },
    observedFrom: workout.performedAt as number, observedTo: workout.completedAt as number,
    createdAt: data.now - 1, updatedAt: data.now,
  }));
  return { ...fixture, feedback };
}

export function continuityAutomaticFixture() {
  const fixture = continuityFixture();
  fixture.data.source.prescriptionMode = 'AUTOMATIC';
  fixture.data.history = fixture.data.history.map(workout => {
    const session = sessionsForMicrocycle(fixture.data.source, fixture.data.routine.generation.goal, workout.microcycleIndex)[0];
    const planned = session.exercises[0];
    const previous = workout.exercises[0];
    return { ...workout, exercises: [{ ...previous, sets: planned.sets.map((set, index) => ({
      ...previous.sets[index], id: plannedSetId(session.index, planned.order, index),
      targetRIR: set.targetRIR, targetReps: set.targetReps, actualRIR: set.targetRIR,
    })) }] };
  });
  return fixture;
}
