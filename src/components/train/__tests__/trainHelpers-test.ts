import { rirColor, RIR_COLORS } from '@/components/train/rirColor';
import { setTypeLabel, SELECTABLE_SET_TYPES } from '@/components/train/setTypeLabel';
import { SetType } from '@/models';

describe('rirColor', () => {
  test('0 es rojo (fallo)', () => {
    expect(rirColor(0)).toBe(RIR_COLORS[0]);
  });

  test('5 es el extremo verde', () => {
    expect(rirColor(5)).toBe(RIR_COLORS[5]);
  });

  test('cada valor 0..5 tiene su color', () => {
    for (let i = 0; i <= 5; i++) {
      expect(rirColor(i)).toBe(RIR_COLORS[i]);
    }
  });

  test('recorta por arriba', () => {
    expect(rirColor(9)).toBe(RIR_COLORS[5]);
  });

  test('recorta por abajo (negativos)', () => {
    expect(rirColor(-3)).toBe(RIR_COLORS[0]);
  });

  test('redondea decimales', () => {
    expect(rirColor(2.4)).toBe(RIR_COLORS[2]);
    expect(rirColor(2.6)).toBe(RIR_COLORS[3]);
  });

  test('no finito → extremo seguro', () => {
    expect(rirColor(NaN)).toBe(RIR_COLORS[5]);
  });
});

describe('setTypeLabel', () => {
  test('siglas universales', () => {
    expect(setTypeLabel(SetType.WARMUP)).toBe('W');
    expect(setTypeLabel(SetType.FAILURE)).toBe('F');
    expect(setTypeLabel(SetType.MYO_REP)).toBe('M');
    expect(setTypeLabel(SetType.DROP_SET)).toBe('DS');
    expect(setTypeLabel(SetType.REST_PAUSE)).toBe('RP');
  });

  test('NORMAL no tiene sigla (usa el número)', () => {
    expect(setTypeLabel(SetType.NORMAL)).toBe('');
  });

  test('todos los tipos son seleccionables', () => {
    expect(SELECTABLE_SET_TYPES).toHaveLength(6);
    expect(SELECTABLE_SET_TYPES).toContain(SetType.WARMUP);
    expect(SELECTABLE_SET_TYPES).toContain(SetType.REST_PAUSE);
  });
});
