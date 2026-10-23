import { rankSwapCandidates, bestSwapCandidate } from '@/services/training/swapEngine';
import { Equipment, ExerciseProfile, MovementVector, MuscleGroup, type Exercise } from '@/models';

/** Helper para construir ejercicios de prueba. */
function ex(
  id: string,
  movementVector: MovementVector,
  primaryMuscle: MuscleGroup,
  isCustom = false,
): Exercise {
  return {
    id,
    name: id,
    primaryMuscle,
    secondaryMuscles: [],
    movementVector,
    profile: ExerciseProfile.COMPOUND_SECONDARY,
    equipment: Equipment.MACHINE,
    isCustom,
  };
}

// Objetivo: empuje horizontal, pecho medio (banca plana).
const target = ex('bench', MovementVector.PUSH_HORIZONTAL, MuscleGroup.CHEST);

describe('rankSwapCandidates', () => {
  test('uses all primary muscles and movement patterns, then matches equipment and recording', () => {
    const same = { ...target, id: 'same' };
    const otherEquipment = { ...same, id: 'barbell', equipment: Equipment.BARBELL };
    const timed = { ...same, id: 'timed', recording: { measure: 'SECONDS' as const, load: 'NONE' as const } };
    const multi = { ...same, id: 'multi', primaryMuscle: MuscleGroup.TRICEPS, primaryMuscles: [MuscleGroup.TRICEPS, MuscleGroup.CHEST], movementVector: MovementVector.ELBOW_EXTENSION,
      movementVectors: [MovementVector.ELBOW_EXTENSION, MovementVector.PUSH_HORIZONTAL] };
    expect(rankSwapCandidates(target, [timed, otherEquipment, multi, same]).map((entry) => entry.id)).toEqual(['multi', 'same', 'barbell', 'timed']);
  });
  test('catálogo vacío → []', () => {
    expect(rankSwapCandidates(target, [])).toEqual([]);
  });

  test('excluye el propio target por id', () => {
    const ranked = rankSwapCandidates(target, [target]);
    expect(ranked).toEqual([]);
  });

  test('orden de cascada: vector+músculo > vector > músculo > resto', () => {
    const both = ex('machine-press', MovementVector.PUSH_HORIZONTAL, MuscleGroup.CHEST);
    const vectorOnly = ex('row-error', MovementVector.PUSH_HORIZONTAL, MuscleGroup.TRICEPS);
    const muscleOnly = ex('fly', MovementVector.ELBOW_FLEXION, MuscleGroup.CHEST);
    const neither = ex('squat', MovementVector.KNEE_DOMINANT, MuscleGroup.QUADS);

    const ranked = rankSwapCandidates(target, [neither, muscleOnly, vectorOnly, both]);
    expect(ranked.map((e) => e.id)).toEqual(['machine-press', 'row-error', 'fly', 'squat']);
  });

  test('ranks a classified private variant above unrelated native movements', () => {
    const customPerfect = ex('custom-press', MovementVector.PUSH_HORIZONTAL, MuscleGroup.CHEST, true);
    const nativeMuscleOnly = ex('fly', MovementVector.ELBOW_FLEXION, MuscleGroup.CHEST);

    const ranked = rankSwapCandidates(target, [customPerfect, nativeMuscleOnly]);
    expect(ranked.map((e) => e.id)).toEqual(['custom-press', 'fly']);
  });

  test('solo personalizados: se ordenan entre sí por su cascada', () => {
    const customVector = ex('c-vector', MovementVector.PUSH_HORIZONTAL, MuscleGroup.TRICEPS, true);
    const customBoth = ex('c-both', MovementVector.PUSH_HORIZONTAL, MuscleGroup.CHEST, true);
    const ranked = rankSwapCandidates(target, [customVector, customBoth]);
    expect(ranked.map((e) => e.id)).toEqual(['c-both', 'c-vector']);
  });

  test('empate de tier: conserva orden de entrada (estable)', () => {
    const a = ex('a', MovementVector.PUSH_HORIZONTAL, MuscleGroup.CHEST);
    const b = ex('b', MovementVector.PUSH_HORIZONTAL, MuscleGroup.CHEST);
    const c = ex('c', MovementVector.PUSH_HORIZONTAL, MuscleGroup.CHEST);
    expect(rankSwapCandidates(target, [a, b, c]).map((e) => e.id)).toEqual(['a', 'b', 'c']);
    expect(rankSwapCandidates(target, [c, b, a]).map((e) => e.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('bestSwapCandidate', () => {
  test('sin candidatos → null', () => {
    expect(bestSwapCandidate(target, [])).toBeNull();
  });

  test('solo el propio target → null', () => {
    expect(bestSwapCandidate(target, [target])).toBeNull();
  });

  test('devuelve el mejor (vector+músculo)', () => {
    const both = ex('machine-press', MovementVector.PUSH_HORIZONTAL, MuscleGroup.CHEST);
    const muscleOnly = ex('fly', MovementVector.ELBOW_FLEXION, MuscleGroup.CHEST);
    expect(bestSwapCandidate(target, [muscleOnly, both])?.id).toBe('machine-press');
  });

  test('prefers the most similar candidate regardless of its source', () => {
    const custom = ex('c', MovementVector.PUSH_HORIZONTAL, MuscleGroup.CHEST, true);
    const nativeMuscle = ex('fly', MovementVector.ELBOW_FLEXION, MuscleGroup.CHEST);
    expect(bestSwapCandidate(target, [custom, nativeMuscle])?.id).toBe('c');
  });
});
