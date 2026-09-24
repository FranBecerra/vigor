/**
 * Máquina de estados del mesociclo (PRD §3.1, §3.3).
 *
 * Estados: ACTIVE → DELOAD → COMPLETED, con INTERRUPTED alcanzable desde
 * cualquier estado no terminal (aborto manual, §3.3.3).
 *
 * Transiciones permitidas:
 *   ACTIVE      → DELOAD | COMPLETED | INTERRUPTED
 *   DELOAD      → ACTIVE | COMPLETED | INTERRUPTED
 *   COMPLETED   → (terminal)
 *   INTERRUPTED → (terminal)
 *
 * Funciones puras (objetivo 100% cobertura).
 */
import type { MesocycleStatus } from '@/models';

const TRANSITIONS: Record<MesocycleStatus, readonly MesocycleStatus[]> = {
  ACTIVE: ['DELOAD', 'COMPLETED', 'INTERRUPTED'],
  DELOAD: ['ACTIVE', 'COMPLETED', 'INTERRUPTED'],
  COMPLETED: [],
  INTERRUPTED: [],
};

/** ¿Es válida la transición de `from` a `to`? */
export function canTransition(from: MesocycleStatus, to: MesocycleStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** ¿Es un estado terminal (no admite más transiciones)? */
export function isTerminal(status: MesocycleStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/**
 * Aplica una transición. Devuelve el nuevo estado si es válida; lanza si no.
 */
export function transition(from: MesocycleStatus, to: MesocycleStatus): MesocycleStatus {
  if (!canTransition(from, to)) {
    throw new Error(`Transición inválida de mesociclo: ${from} → ${to}`);
  }
  return to;
}

/**
 * Avanza el índice de microciclo. Devuelve el nuevo índice.
 * Solo tiene sentido en estados no terminales.
 * @throws si el estado es terminal o el índice es inválido
 */
export function advanceMicrocycle(currentIndex: number, status: MesocycleStatus): number {
  if (isTerminal(status)) {
    throw new Error(`No se puede avanzar microciclo en estado terminal: ${status}`);
  }
  if (!Number.isInteger(currentIndex) || currentIndex < 0) {
    throw new Error('advanceMicrocycle: currentIndex debe ser entero >= 0');
  }
  return currentIndex + 1;
}
