import { epleyE1RM, relativeE1RMChange } from '@/services/analytics/e1rm';

describe('epleyE1RM', () => {
  test('reps = 1 devuelve el propio peso (1RM real)', () => {
    expect(epleyE1RM(100, 1)).toBeCloseTo(100 * (1 + 1 / 30));
  });

  test('caso conocido: 80kg x 8 ≈ 101.33kg', () => {
    expect(epleyE1RM(80, 8)).toBeCloseTo(80 * (1 + 8 / 30), 5);
  });

  test('a más reps, mayor e1RM', () => {
    expect(epleyE1RM(100, 10)).toBeGreaterThan(epleyE1RM(100, 5));
  });

  test.each([0, -5, NaN, Infinity])('peso inválido (%p) lanza', (w) => {
    expect(() => epleyE1RM(w as number, 5)).toThrow();
  });

  test.each([0, -1, 1.5, NaN])('reps inválidas (%p) lanzan', (r) => {
    expect(() => epleyE1RM(100, r as number)).toThrow();
  });
});

describe('relativeE1RMChange', () => {
  test('progreso positivo: +5%', () => {
    expect(relativeE1RMChange(105, 100)).toBeCloseTo(0.05);
  });

  test('sin cambio: 0', () => {
    expect(relativeE1RMChange(100, 100)).toBe(0);
  });

  test('regresión: negativo', () => {
    expect(relativeE1RMChange(90, 100)).toBeCloseTo(-0.1);
  });

  test.each([0, -10, NaN])('baseline inválido (%p) lanza', (b) => {
    expect(() => relativeE1RMChange(100, b as number)).toThrow();
  });

  test.each([-1, NaN, Infinity])('current inválido (%p) lanza', (c) => {
    expect(() => relativeE1RMChange(c as number, 100)).toThrow();
  });
});
