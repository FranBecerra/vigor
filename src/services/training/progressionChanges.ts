import type { Mesocycle, PlannedSet } from '@/models';
import type { ProgressionStep } from './rirReplanning';
import { sessionsForMicrocycle } from './mesocycleEditing';

export function progressionBaseline(source: Mesocycle, goal: string, steps: readonly ProgressionStep[]) {
  return steps.map(step => {
    const session = sessionsForMicrocycle(source, goal, step.index).find(item => item.index === step.session.index);
    if (!session) throw Error('Missing progression baseline');
    return { index: step.index, isDeload: step.isDeload, session };
  });
}

const fields = ['setType', 'targetRepsMin', 'targetReps', 'targetRIR', 'targetWeightKg', 'targetDurationSeconds', 'targetLoadLevel'] as const;
type SetField = typeof fields[number];

function value(set: PlannedSet | undefined, field: SetField) {
  return field === 'targetRepsMin' ? set?.targetRepsMin ?? set?.targetReps : set?.[field];
}

/** Presentation diff only. The full proposal remains the save and stale-check payload. */
export function progressionChanges(steps: readonly ProgressionStep[], baseline: readonly ProgressionStep[]) {
  return steps.flatMap(step => {
    const before = baseline.find(previous => previous.index === step.index && previous.session.index === step.session.index)?.session;
    const ids = [...new Set([...step.session.exercises.map(exercise => exercise.exerciseId), ...(before?.exercises.map(exercise => exercise.exerciseId) ?? [])])];
    const exercises = ids.flatMap(id => {
      const previous = before?.exercises.find(exercise => exercise.exerciseId === id);
      const next = step.session.exercises.find(exercise => exercise.exerciseId === id);
      const sets = Array.from({ length: Math.max(previous?.sets.length ?? 0, next?.sets.length ?? 0) }, (_, index) => {
        const from = previous?.sets[index], to = next?.sets[index];
        return { index, kind: !from ? 'added' as const : !to ? 'removed' as const : 'updated' as const,
          fields: fields.flatMap(field => value(from, field) === value(to, field) ? [] : [{ field, from: value(from, field), to: value(to, field) }]) };
      }).filter(set => set.kind !== 'updated' || set.fields.length > 0);
      const details = [
        ...(previous?.restSeconds !== next?.restSeconds ? [{ field: 'rest' as const, from: previous?.restSeconds, to: next?.restSeconds }] : []),
        ...(previous?.order !== next?.order ? [{ field: 'order' as const, from: previous ? previous.order + 1 : undefined, to: next ? next.order + 1 : undefined }] : []),
      ];
      return sets.length || details.length || !previous || !next ? [{ exerciseId: id,
        snapshot: next?.exerciseSnapshot ?? previous?.exerciseSnapshot,
        kind: !previous ? 'added' as const : !next ? 'removed' as const : 'updated' as const, sets, details }] : [];
    });
    return exercises.length ? [{ index: step.index, isDeload: step.isDeload, exercises }] : [];
  });
}
