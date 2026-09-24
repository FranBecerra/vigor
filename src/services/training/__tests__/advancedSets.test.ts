import { SetType, type WorkoutSet } from '@/models';
import {
  extensionWeight,
  formatReps,
  formatWeightProgression,
  hasExtensions,
  mainReps,
  mainWeight,
  supportsExtensions,
  totalReps,
  totalVolumeLoad,
} from '@/services/training/advancedSets';

/** Serie base para los tests; cada test sobrescribe lo que necesita. */
function makeSet(overrides: Partial<WorkoutSet> = {}): WorkoutSet {
  return {
    id: 's1',
    setType: SetType.NORMAL,
    targetReps: 10,
    targetRIR: 2,
    targetWeight: 60,
    isAutoFilled: false,
    ...overrides,
  };
}

describe('supportsExtensions', () => {
  it('admite tramos en Rest Pause, MyoReps y Drop Set', () => {
    expect(supportsExtensions(SetType.REST_PAUSE)).toBe(true);
    expect(supportsExtensions(SetType.MYO_REP)).toBe(true);
    expect(supportsExtensions(SetType.DROP_SET)).toBe(true);
  });

  it('NO admite tramos en normal, calentamiento ni fallo', () => {
    expect(supportsExtensions(SetType.NORMAL)).toBe(false);
    expect(supportsExtensions(SetType.WARMUP)).toBe(false);
    // Llevar al fallo marca la intención, no genera tramos.
    expect(supportsExtensions(SetType.FAILURE)).toBe(false);
  });
});

describe('hasExtensions', () => {
  it('es false sin tramos y con lista vacía', () => {
    expect(hasExtensions(makeSet())).toBe(false);
    expect(hasExtensions(makeSet({ extensions: [] }))).toBe(false);
  });

  it('es true con al menos un tramo', () => {
    expect(hasExtensions(makeSet({ extensions: [{ reps: 3 }] }))).toBe(true);
  });
});

describe('mainWeight / mainReps', () => {
  it('usa el valor real cuando existe', () => {
    const set = makeSet({ actualWeight: 62.5, actualReps: 9 });
    expect(mainWeight(set)).toBe(62.5);
    expect(mainReps(set)).toBe(9);
  });

  it('cae al objetivo cuando no hay valor real', () => {
    const set = makeSet();
    expect(mainWeight(set)).toBe(60);
    expect(mainReps(set)).toBe(10);
  });

  it('respeta un valor real de 0 en lugar de caer al objetivo', () => {
    const set = makeSet({ actualReps: 0, actualWeight: 0 });
    expect(mainReps(set)).toBe(0);
    expect(mainWeight(set)).toBe(0);
  });
});

describe('extensionWeight', () => {
  it('hereda el peso de la serie principal si el tramo no lo cambia', () => {
    const set = makeSet({ actualWeight: 62.5 });
    expect(extensionWeight(set, { reps: 3 })).toBe(62.5);
  });

  it('usa el peso propio del tramo cuando lo tiene (Drop Set)', () => {
    const set = makeSet({ actualWeight: 60 });
    expect(extensionWeight(set, { reps: 5, weight: 50 })).toBe(50);
  });
});

describe('totalReps', () => {
  it('es la serie principal cuando no hay tramos', () => {
    expect(totalReps(makeSet({ actualReps: 9 }))).toBe(9);
  });

  it('suma los tramos (Rest Pause 10+3+2)', () => {
    const set = makeSet({ actualReps: 10, extensions: [{ reps: 3 }, { reps: 2 }] });
    expect(totalReps(set)).toBe(15);
  });

  it('suma también con tramos a distinto peso (Drop Set)', () => {
    const set = makeSet({
      actualReps: 8,
      extensions: [
        { reps: 6, weight: 50 },
        { reps: 4, weight: 40 },
      ],
    });
    expect(totalReps(set)).toBe(18);
  });
});

describe('totalVolumeLoad', () => {
  it('multiplica reps por peso en una serie simple', () => {
    expect(totalVolumeLoad(makeSet({ actualReps: 10, actualWeight: 60 }))).toBe(600);
  });

  it('usa el peso heredado en los tramos sin peso propio', () => {
    const set = makeSet({ actualReps: 10, actualWeight: 60, extensions: [{ reps: 3 }] });
    expect(totalVolumeLoad(set)).toBe(600 + 180);
  });

  it('usa el peso de cada tramo en un Drop Set', () => {
    const set = makeSet({
      actualReps: 8,
      actualWeight: 60,
      extensions: [
        { reps: 6, weight: 50 },
        { reps: 4, weight: 40 },
      ],
    });
    // 8×60 + 6×50 + 4×40 = 480 + 300 + 160
    expect(totalVolumeLoad(set)).toBe(940);
  });

  it('cae a los valores objetivo si no hay registrados', () => {
    expect(totalVolumeLoad(makeSet())).toBe(600);
  });
});

describe('formatReps', () => {
  it('muestra un único número en una serie normal', () => {
    expect(formatReps(makeSet({ actualReps: 9 }))).toBe('9');
  });

  it('concatena los tramos con +', () => {
    const set = makeSet({ actualReps: 10, extensions: [{ reps: 3 }, { reps: 2 }] });
    expect(formatReps(set)).toBe('10+3+2');
  });

  it('usa el objetivo si la serie aún no se ha registrado', () => {
    expect(formatReps(makeSet())).toBe('10');
  });
});

describe('formatWeightProgression', () => {
  it('devuelve null si ningún tramo cambia el peso (Rest Pause)', () => {
    const set = makeSet({ extensions: [{ reps: 3 }, { reps: 2 }] });
    expect(formatWeightProgression(set)).toBeNull();
  });

  it('devuelve null sin tramos', () => {
    expect(formatWeightProgression(makeSet())).toBeNull();
  });

  it('describe la bajada de peso de un Drop Set', () => {
    const set = makeSet({
      actualWeight: 60,
      extensions: [
        { reps: 6, weight: 50 },
        { reps: 4, weight: 40 },
      ],
    });
    expect(formatWeightProgression(set)).toBe('60 → 50 → 40');
  });

  it('rellena con el peso heredado los tramos que no lo cambian', () => {
    const set = makeSet({
      actualWeight: 60,
      extensions: [{ reps: 3 }, { reps: 4, weight: 40 }],
    });
    expect(formatWeightProgression(set)).toBe('60 → 60 → 40');
  });
});


describe('borradores de tramos vacíos', () => {
  it('no inventa reps ni tonelaje mientras un tramo está vacío', () => {
    const set = makeSet({ actualReps: 10, actualWeight: 60, extensions: [{}] });
    expect(totalReps(set)).toBe(10);
    expect(totalVolumeLoad(set)).toBe(600);
  });

  it('muestra un guion para un tramo todavía sin reps', () => {
    expect(formatReps(makeSet({ actualReps: 10, extensions: [{}] }))).toBe('10+—');
  });
});