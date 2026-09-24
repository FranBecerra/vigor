import {
  canTransition,
  isTerminal,
  transition,
  advanceMicrocycle,
} from '@/services/training/mesocycleStateMachine';

describe('canTransition', () => {
  test('ACTIVE puede ir a DELOAD/COMPLETED/INTERRUPTED', () => {
    expect(canTransition('ACTIVE', 'DELOAD')).toBe(true);
    expect(canTransition('ACTIVE', 'COMPLETED')).toBe(true);
    expect(canTransition('ACTIVE', 'INTERRUPTED')).toBe(true);
  });

  test('DELOAD puede volver a ACTIVE o terminar', () => {
    expect(canTransition('DELOAD', 'ACTIVE')).toBe(true);
    expect(canTransition('DELOAD', 'COMPLETED')).toBe(true);
    expect(canTransition('DELOAD', 'INTERRUPTED')).toBe(true);
  });

  test('estados terminales no transicionan', () => {
    expect(canTransition('COMPLETED', 'ACTIVE')).toBe(false);
    expect(canTransition('INTERRUPTED', 'ACTIVE')).toBe(false);
  });

  test('ACTIVE no puede ir a ACTIVE (no-op no permitido)', () => {
    expect(canTransition('ACTIVE', 'ACTIVE')).toBe(false);
  });
});

describe('isTerminal', () => {
  test.each(['COMPLETED', 'INTERRUPTED'] as const)('%s es terminal', (s) => {
    expect(isTerminal(s)).toBe(true);
  });
  test.each(['ACTIVE', 'DELOAD'] as const)('%s no es terminal', (s) => {
    expect(isTerminal(s)).toBe(false);
  });
});

describe('transition', () => {
  test('transición válida devuelve el destino', () => {
    expect(transition('ACTIVE', 'DELOAD')).toBe('DELOAD');
  });
  test('transición inválida lanza', () => {
    expect(() => transition('COMPLETED', 'ACTIVE')).toThrow();
  });
});

describe('advanceMicrocycle', () => {
  test('incrementa el índice', () => {
    expect(advanceMicrocycle(0, 'ACTIVE')).toBe(1);
    expect(advanceMicrocycle(5, 'DELOAD')).toBe(6);
  });
  test('lanza en estado terminal', () => {
    expect(() => advanceMicrocycle(3, 'COMPLETED')).toThrow();
  });
  test.each([-1, 1.5, NaN])('índice inválido (%p) lanza', (i) => {
    expect(() => advanceMicrocycle(i as number, 'ACTIVE')).toThrow();
  });
});
