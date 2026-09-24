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
const target = ex('bench', MovementVector.PUSH_HORIZONTAL, MuscleGroup.CHEST_MID_LOWER);

describe('rankSwapCandidates', () => {
  test('catálogo vacío → []', () => {
    expect(rankSwapCandidates(target, [])).toEqual([]);
  });

  test('excluye el propio target por id', () => {
    const ranked = rankSwapCandidates(target, [target]);
    expect(ranked).toEqual([]);
  });

  test('orden de cascada: vector+músculo > vector > músculo > resto', () => {
    const both = ex('machine-press', MovementVector.PUSH_HORIZONTAL, MuscleGroup.CHEST_MID_LOWER);
    const vectorOnly = ex('row-error', MovementVector.PUSH_HORIZONTAL, MuscleGroup.TRICEPS);
    const muscleOnly = ex('fly', MovementVector.ELBOW_FLEXION, MuscleGroup.CHEST_MID_LOWER);
    const neither = ex('squat', MovementVector.KNEE_DOMINANT, MuscleGroup.QUADS);

    const ranked = rankSwapCandidates(target, [neither, muscleOnly, vectorOnly, both]);
    expect(ranked.map((e) => e.id)).toEqual(['machine-press', 'row-error', 'fly', 'squat']);
  });

  test('personalizados van al final aunque coincidan en vector+músculo', () => {
    const customPerfect = ex('custom-press', MovementVector.PUSH_HORIZONTAL, MuscleGroup.CHEST_MID_LOWER, true);
    const nativeMuscleOnly = ex('fly', MovementVector.ELBOW_FLEXION, MuscleGroup.CHEST_MID_LOWER);

    const ranked = rankSwapCandidates(target, [customPerfect, nativeMuscleOnly]);
    // El nativo (aunque solo coincida en músculo) va antes que el custom perfecto.
    expect(ranked.map((e) => e.id)).toEqual(['fly', 'custom-press']);
  });

  test('solo personalizados: se ordenan entre sí por su cascada', () => {
    const customVector = ex('c-vector', MovementVector.PUSH_HORIZONTAL, MuscleGroup.TRICEPS, true);
    const customBoth = ex('c-both', MovementVector.PUSH_HORIZONTAL, MuscleGroup.CHEST_MID_LOWER, true);
    const ranked = rankSwapCandidates(target, [customVector, customBoth]);
    expect(ranked.map((e) => e.id)).toEqual(['c-both', 'c-vector']);
  });

  test('empate de tier: conserva orden de entrada (estable)', () => {
    const a = ex('a', MovementVector.PUSH_HORIZONTAL, MuscleGroup.CHEST_MID_LOWER);
    const b = ex('b', MovementVector.PUSH_HORIZONTAL, MuscleGroup.CHEST_MID_LOWER);
    const c = ex('c', MovementVector.PUSH_HORIZONTAL, MuscleGroup.CHEST_MID_LOWER);
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
    const both = ex('machine-press', MovementVector.PUSH_HORIZONTAL, MuscleGroup.CHEST_MID_LOWER);
    const muscleOnly = ex('fly', MovementVector.ELBOW_FLEXION, MuscleGroup.CHEST_MID_LOWER);
    expect(bestSwapCandidate(target, [muscleOnly, both])?.id).toBe('machine-press');
  });

  test('prefiere nativo sobre custom perfecto', () => {
    const custom = ex('c', MovementVector.PUSH_HORIZONTAL, MuscleGroup.CHEST_MID_LOWER, true);
    const nativeMuscle = ex('fly', MovementVector.ELBOW_FLEXION, MuscleGroup.CHEST_MID_LOWER);
    expect(bestSwapCandidate(target, [custom, nativeMuscle])?.id).toBe('fly');
  });
});
