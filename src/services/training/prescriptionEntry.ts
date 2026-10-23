import { SetType, type PlannedSet } from '@/models';
import type { PreviewExerciseEdit } from './previewEditing';

export type PrescriptionField = 'reps' | 'min' | 'max' | 'rir' | 'seconds' | 'rest' | 'type';

/** Commit one complete numeric draft. Empty/invalid drafts leave the prescription intact. */
export function prescriptionPatch(set: PlannedSet, field: PrescriptionField, value: number | undefined): Partial<PlannedSet> {
  if (value === undefined || !Number.isFinite(value) || set.setType === SetType.TOP_SINGLE || field === 'rest' || field === 'type') return {};
  if (field === 'rir' && set.setType === SetType.FAILURE) return { targetRIR: 0 };
  const bounded = Math.max(field === 'rir' ? 0 : 1, Math.min(field === 'rir' ? 5 : field === 'seconds' ? 3600 : 100, Math.trunc(value)));
  if (field === 'rir') return { targetRIR: bounded };
  if (field === 'seconds') return { targetDurationSeconds: bounded };
  if (field === 'min') return { targetRepsMin: bounded };
  if (field === 'max') return { targetReps: bounded };
  return { targetRepsMin: bounded, targetReps: bounded };
}

/** Merge a single-set edit without replacing neighbouring ranges or manually chosen RIR. */
export function mergePrescriptionEdit(edit: PreviewExerciseEdit | undefined, sets: readonly PlannedSet[], index: number, patch: Partial<PlannedSet>): PreviewExerciseEdit {
  const set = sets[index];
  if (!set || set.setType === SetType.TOP_SINGLE) return edit ?? {};
  const previousRange = edit?.repsBySet?.[index];
  return {
    ...edit,
    ...(patch.setType !== undefined && patch.setType !== SetType.TOP_SINGLE ? { typeBySet: { ...edit?.typeBySet, [index]: patch.setType },
      ...(patch.setType === SetType.FAILURE ? { rirBySet: { ...edit?.rirBySet, [index]: 0 } } : {}) } : {}),
    ...(patch.targetReps !== undefined || patch.targetRepsMin !== undefined ? { repsBySet: {
      ...edit?.repsBySet, [index]: {
        min: patch.targetRepsMin ?? previousRange?.min ?? set.targetRepsMin ?? set.targetReps,
        max: patch.targetReps ?? previousRange?.max ?? set.targetReps,
      },
    } } : {}),
    ...(patch.targetRIR !== undefined ? { rirBySet: { ...edit?.rirBySet, [index]: patch.targetRIR } } : {}),
    ...(patch.targetDurationSeconds !== undefined ? { secondsBySet: { ...edit?.secondsBySet, [index]: patch.targetDurationSeconds } } : {}),
  };
}
