import {
  muscleProgressIndex,
  muscleProgressIndexFromE1RM,
  PROFILE_WEIGHT,
} from '@/services/analytics/mpi';
import { ExerciseProfile } from '@/models';

describe('PROFILE_WEIGHT', () => {
  test('pesos biomecánicos del PRD §3.2.2', () => {
    expect(PROFILE_WEIGHT[ExerciseProfile.COMPOUND_PRIMARY]).toBe(0.5);
    expect(PROFILE_WEIGHT[ExerciseProfile.COMPOUND_SECONDARY]).toBe(0.35);
    expect(PROFILE_WEIGHT[ExerciseProfile.ISOLATION]).toBe(0.15);
  });
});

describe('muscleProgressIndex', () => {
  test('lista vacía → 0', () => {
    expect(muscleProgressIndex([])).toBe(0);
  });

  test('un solo ejercicio → su propio deltaE1RM', () => {
    expect(muscleProgressIndex([{ weight: 0.5, deltaE1RM: 0.04 }])).toBeCloseTo(0.04);
  });

  test('media ponderada correcta', () => {
    // (0.5*0.06 + 0.15*0.02) / (0.5+0.15) = 0.033/0.65
    const mpi = muscleProgressIndex([
      { weight: 0.5, deltaE1RM: 0.06 },
      { weight: 0.15, deltaE1RM: 0.02 },
    ]);
    expect(mpi).toBeCloseTo((0.5 * 0.06 + 0.15 * 0.02) / 0.65, 6);
  });

  test('renormaliza sobre presentes: omitir un ejercicio (swap) no distorsiona', () => {
    // Si solo queda el primario, el MPI es su delta puro (Σw normaliza).
    const soloPrimario = muscleProgressIndex([{ weight: 0.5, deltaE1RM: 0.06 }]);
    expect(soloPrimario).toBeCloseTo(0.06);
  });

  test('pesos iguales → media aritmética', () => {
    expect(
      muscleProgressIndex([
        { weight: 0.3, deltaE1RM: 0.02 },
        { weight: 0.3, deltaE1RM: 0.08 },
      ]),
    ).toBeCloseTo(0.05);
  });

  test('regresión generalizada → MPI negativo', () => {
    expect(muscleProgressIndex([{ weight: 0.5, deltaE1RM: -0.03 }])).toBeCloseTo(-0.03);
  });

  test.each([0, -0.1, NaN])('weight inválido (%p) lanza', (w) => {
    expect(() => muscleProgressIndex([{ weight: w as number, deltaE1RM: 0.05 }])).toThrow();
  });

  test('deltaE1RM no finito lanza', () => {
    expect(() => muscleProgressIndex([{ weight: 0.5, deltaE1RM: Infinity }])).toThrow();
  });
});

describe('muscleProgressIndexFromE1RM', () => {
  test('traduce perfiles y e1RM a MPI', () => {
    const mpi = muscleProgressIndexFromE1RM([
      { profile: ExerciseProfile.COMPOUND_PRIMARY, baselineE1RM: 100, currentE1RM: 106 }, // +6%
      { profile: ExerciseProfile.ISOLATION, baselineE1RM: 50, currentE1RM: 51 }, // +2%
    ]);
    expect(mpi).toBeCloseTo((0.5 * 0.06 + 0.15 * 0.02) / 0.65, 6);
  });

  test('un swap (ejercicio omitido) usa solo los presentes', () => {
    const mpi = muscleProgressIndexFromE1RM([
      { profile: ExerciseProfile.COMPOUND_PRIMARY, baselineE1RM: 100, currentE1RM: 105 },
    ]);
    expect(mpi).toBeCloseTo(0.05);
  });

  test('baseline inválido propaga error', () => {
    expect(() =>
      muscleProgressIndexFromE1RM([
        { profile: ExerciseProfile.ISOLATION, baselineE1RM: 0, currentE1RM: 10 },
      ]),
    ).toThrow();
  });
});
