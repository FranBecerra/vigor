import {
  MAX_RIR,
  MIN_RIR,
  adjustSetRIRs,
  clampSetRIR,
  deriveSetRIRs,
  formatSetRIRs,
} from '@/services/training/setIntensity';

describe('clampSetRIR', () => {
  it('acota al rango admitido', () => {
    expect(clampSetRIR(-3)).toBe(MIN_RIR);
    expect(clampSetRIR(9)).toBe(MAX_RIR);
  });

  it('rounds to whole reps in reserve, halves toward more reserve', () => {
    expect(clampSetRIR(2.24)).toBe(2);
    expect(clampSetRIR(2.26)).toBe(2);
    expect(clampSetRIR(2.5)).toBe(3);
    expect(clampSetRIR(1.6)).toBe(2);
  });

  it('trata un valor no finito como el mínimo', () => {
    expect(clampSetRIR(Number.NaN)).toBe(MIN_RIR);
  });
});

describe('deriveSetRIRs', () => {
  it('deja más reserva en las primeras series y aprieta en la última', () => {
    expect(deriveSetRIRs(2, 3)).toEqual([4, 3, 2]);
  });

  it('respeta el tope de reserva extra', () => {
    expect(deriveSetRIRs(1, 5)).toEqual([3, 3, 3, 2, 1]);
  });

  it('con una sola serie usa el objetivo tal cual', () => {
    expect(deriveSetRIRs(2, 1)).toEqual([2]);
  });

  it('no inventa prescripción sin series', () => {
    expect(deriveSetRIRs(2, 0)).toEqual([]);
    expect(deriveSetRIRs(2, -1)).toEqual([]);
  });

  it('nunca supera el máximo al sumar reserva', () => {
    expect(deriveSetRIRs(5, 3)).toEqual([5, 5, 5]);
  });
});

describe('adjustSetRIRs', () => {
  it('endurece la prescripción con un ajuste negativo', () => {
    expect(adjustSetRIRs([4, 3, 2], -1)).toEqual([3, 2, 1]);
  });

  it('suaviza con un ajuste positivo, respetando el techo', () => {
    expect(adjustSetRIRs([4, 3, 2], 2)).toEqual([5, 5, 4]);
  });

  it('no baja de cero', () => {
    expect(adjustSetRIRs([1, 0], -2)).toEqual([0, 0]);
  });

  it('never returns a fractional RIR, whatever the adjustment', () => {
    expect(adjustSetRIRs([4, 3, 2], 0.5)).toEqual([5, 4, 3]);
    expect(adjustSetRIRs([4, 3, 2], -0.5)).toEqual([4, 3, 2]);
    adjustSetRIRs([4, 3, 2], -1.3).forEach((rir) => expect(Number.isInteger(rir)).toBe(true));
    deriveSetRIRs(1.5, 3).forEach((rir) => expect(Number.isInteger(rir)).toBe(true));
  });
});

describe('formatSetRIRs', () => {
  it('une los valores con separador legible', () => {
    expect(formatSetRIRs([4, 3, 2])).toBe('4 · 3 · 2');
  });

  it('muestra un decimal solo cuando existe', () => {
    expect(formatSetRIRs([2.5, 2])).toBe('2.5 · 2');
  });

  it('devuelve cadena vacía sin series', () => {
    expect(formatSetRIRs([])).toBe('');
  });
});
