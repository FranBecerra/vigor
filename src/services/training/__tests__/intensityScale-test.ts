import {
  intensityOptions,
  distanceToFailure,
  intensityLabel,
  intensityColor,
} from '@/services/training/intensityScale';
import { RIR_COLORS } from '@/components/train/rirColor';

describe('intensityOptions', () => {
  test('RIR cuenta hacia arriba desde el fallo', () => {
    expect(intensityOptions('RIR')).toEqual([0, 1, 2, 3, 4, 5]);
  });
  test('RPE cuenta hacia abajo desde el fallo', () => {
    expect(intensityOptions('RPE')).toEqual([10, 9, 8, 7, 6, 5]);
  });
});

describe('distanceToFailure', () => {
  test('RIR: el valor ES la distancia', () => {
    expect(distanceToFailure(0, 'RIR')).toBe(0);
    expect(distanceToFailure(3, 'RIR')).toBe(3);
  });
  test('RPE: se invierte (10 = fallo)', () => {
    expect(distanceToFailure(10, 'RPE')).toBe(0);
    expect(distanceToFailure(8, 'RPE')).toBe(2);
    expect(distanceToFailure(5, 'RPE')).toBe(5);
  });
  test('recorta por arriba y por abajo', () => {
    expect(distanceToFailure(9, 'RIR')).toBe(5);
    expect(distanceToFailure(-2, 'RIR')).toBe(0);
    expect(distanceToFailure(2, 'RPE')).toBe(5);
    expect(distanceToFailure(12, 'RPE')).toBe(0);
  });
  test('redondea decimales', () => {
    expect(distanceToFailure(2.4, 'RIR')).toBe(2);
  });
  test('no finito → extremo lejano', () => {
    expect(distanceToFailure(NaN, 'RIR')).toBe(5);
  });
});

describe('intensityLabel', () => {
  test('null → guion (valor vacío permitido)', () => {
    expect(intensityLabel(null, 'RIR')).toBe('—');
    expect(intensityLabel(null, 'RPE')).toBe('—');
  });
  test('RIR normal', () => {
    expect(intensityLabel(2, 'RIR')).toBe('2');
    expect(intensityLabel(0, 'RIR')).toBe('0');
  });
  test('RIR abierto → +5', () => {
    expect(intensityLabel(5, 'RIR')).toBe('+5');
    expect(intensityLabel(8, 'RIR')).toBe('+5');
  });
  test('RPE normal', () => {
    expect(intensityLabel(8, 'RPE')).toBe('8');
    expect(intensityLabel(10, 'RPE')).toBe('10');
  });
  test('RPE abierto → -5', () => {
    expect(intensityLabel(5, 'RPE')).toBe('-5');
    expect(intensityLabel(3, 'RPE')).toBe('-5');
  });
  test('no finito → guion', () => {
    expect(intensityLabel(NaN, 'RIR')).toBe('—');
  });
});

describe('intensityColor', () => {
  test('null → sin color', () => {
    expect(intensityColor(null, 'RIR')).toBeNull();
  });
  test('fallo es rojo en ambas escalas', () => {
    expect(intensityColor(0, 'RIR')).toBe(RIR_COLORS[0]);
    expect(intensityColor(10, 'RPE')).toBe(RIR_COLORS[0]);
  });
  test('extremo lejano es verde en ambas escalas', () => {
    expect(intensityColor(5, 'RIR')).toBe(RIR_COLORS[5]);
    expect(intensityColor(5, 'RPE')).toBe(RIR_COLORS[5]);
  });
  test('valores intermedios coinciden por distancia', () => {
    expect(intensityColor(2, 'RIR')).toBe(intensityColor(8, 'RPE'));
  });
  test('no finito → sin color', () => {
    expect(intensityColor(NaN, 'RPE')).toBeNull();
  });
});
