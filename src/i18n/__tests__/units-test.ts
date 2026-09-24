import { weightUnitFor, convertWeight, toKilograms } from '@/i18n/units';

describe('weightUnitFor', () => {
  test('US → lb', () => {
    expect(weightUnitFor('us')).toBe('lb');
  });
  test.each(['metric', 'uk', null, undefined] as const)('%p → kg', (s) => {
    expect(weightUnitFor(s)).toBe('kg');
  });
});

describe('convertWeight', () => {
  test('kg se mantiene', () => {
    expect(convertWeight(80, 'kg')).toBe(80);
  });
  test('kg → lb', () => {
    expect(convertWeight(100, 'lb')).toBeCloseTo(220.5, 1);
  });
  test('redondea a 1 decimal', () => {
    expect(convertWeight(82.55, 'kg')).toBe(82.6);
  });
  test('cero es válido', () => {
    expect(convertWeight(0, 'lb')).toBe(0);
  });
  test.each([-1, NaN, Infinity])('valor inválido (%p) lanza', (v) => {
    expect(() => convertWeight(v as number, 'kg')).toThrow();
  });
});

describe('toKilograms', () => {
  test('kg se mantiene', () => {
    expect(toKilograms(80, 'kg')).toBe(80);
  });
  test('lb → kg', () => {
    expect(toKilograms(220.5, 'lb')).toBeCloseTo(100, 0);
  });
  test('ida y vuelta es estable', () => {
    const lb = convertWeight(100, 'lb');
    expect(toKilograms(lb, 'lb')).toBeCloseTo(100, 0);
  });
  test.each([-5, NaN])('valor inválido (%p) lanza', (v) => {
    expect(() => toKilograms(v as number, 'lb')).toThrow();
  });
});
