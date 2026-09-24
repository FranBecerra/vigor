import { evaluateDeload, DELOAD_THRESHOLDS } from '@/services/training/deloadTriggers';

const base = {
  consecutiveFlatMicrocycles: 0,
  recoveryScore: 8,
  fatigueScore: 3,
  maxPainEVA: 0,
  manualAbort: false,
};

describe('evaluateDeload', () => {
  test('estado sano → null', () => {
    expect(evaluateDeload(base)).toBeNull();
  });

  test('dolor EVA > 4 → SAFETY_OVERRIDE', () => {
    expect(evaluateDeload({ ...base, maxPainEVA: 5 })).toBe('SAFETY_OVERRIDE');
  });

  test('EVA exactamente 4 NO dispara (umbral estricto)', () => {
    expect(evaluateDeload({ ...base, maxPainEVA: 4 })).toBeNull();
  });

  test('aborto manual → MANUAL_ABORT', () => {
    expect(evaluateDeload({ ...base, manualAbort: true })).toBe('MANUAL_ABORT');
  });

  test('stall: 2 microciclos planos + recovery bajo → STALL', () => {
    expect(
      evaluateDeload({ ...base, consecutiveFlatMicrocycles: 2, recoveryScore: 4 }),
    ).toBe('STALL');
  });

  test('stall: 2 planos + fatiga alta → STALL', () => {
    expect(
      evaluateDeload({ ...base, consecutiveFlatMicrocycles: 2, fatigueScore: 7 }),
    ).toBe('STALL');
  });

  test('2 planos pero buena recuperación y poca fatiga → null', () => {
    expect(
      evaluateDeload({ ...base, consecutiveFlatMicrocycles: 2, recoveryScore: 8, fatigueScore: 3 }),
    ).toBeNull();
  });

  test('1 solo microciclo plano → null aunque recovery bajo', () => {
    expect(
      evaluateDeload({ ...base, consecutiveFlatMicrocycles: 1, recoveryScore: 3 }),
    ).toBeNull();
  });

  test('prioridad: seguridad manda sobre aborto y stall', () => {
    expect(
      evaluateDeload({
        ...base,
        maxPainEVA: 6,
        manualAbort: true,
        consecutiveFlatMicrocycles: 3,
        recoveryScore: 2,
      }),
    ).toBe('SAFETY_OVERRIDE');
  });

  test('prioridad: aborto manda sobre stall', () => {
    expect(
      evaluateDeload({
        ...base,
        manualAbort: true,
        consecutiveFlatMicrocycles: 3,
        recoveryScore: 2,
      }),
    ).toBe('MANUAL_ABORT');
  });

  test('umbrales expuestos coherentes con el PRD', () => {
    expect(DELOAD_THRESHOLDS.flatMicrocycles).toBe(2);
    expect(DELOAD_THRESHOLDS.painEVA).toBe(4);
  });
});
