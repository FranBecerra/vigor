/**
 * Motor de Sustitución en Cascada (Swap) — PRD §3.5.
 *
 * Dado el ejercicio a sustituir y un catálogo de candidatos, ordena las
 * alternativas bajo reglas algorítmicas descendentes:
 *   1. Vector de Movimiento Exacto (mismo MovementVector).           [tier 1]
 *   2. Grupo Muscular Principal (mismo primaryMuscle).               [tier 2]
 *   3. Resto (misma región pero sin coincidencia fuerte).            [tier 3]
 * Los ejercicios PERSONALIZADOS (isCustom) se apilan SIEMPRE al final,
 * aunque coincidan en vector o músculo, por carecer de mapeo biomecánico
 * profundo (§3.5.3).
 *
 * Funciones puras (objetivo 100% cobertura).
 */
import type { Exercise } from '@/models';

/** Puntuación de prioridad de un candidato (menor = mejor). */
function tierOf(target: Exercise, candidate: Exercise): number {
  const sameVector = candidate.movementVector === target.movementVector;
  const sameMuscle = candidate.primaryMuscle === target.primaryMuscle;

  // Personalizados: al final de su franja natural. Se les suma un offset grande
  // para que queden por detrás de cualquier no-personalizado.
  const customOffset = candidate.isCustom ? 10 : 0;

  if (sameVector && sameMuscle) return 0 + customOffset;
  if (sameVector) return 1 + customOffset; // vector exacto (§3.5.1)
  if (sameMuscle) return 2 + customOffset; // grupo muscular principal (§3.5.2)
  return 3 + customOffset; // resto
}

/**
 * Devuelve los candidatos ordenados como alternativas de swap para `target`.
 * - Excluye el propio `target` (mismo id).
 * - Orden: por tier ascendente; empates conservan el orden de entrada (estable).
 *
 * @param target ejercicio a sustituir
 * @param candidates catálogo de posibles alternativas
 */
export function rankSwapCandidates(target: Exercise, candidates: Exercise[]): Exercise[] {
  return candidates
    .filter((c) => c.id !== target.id)
    .map((c, index) => ({ c, index, tier: tierOf(target, c) }))
    .sort((a, b) => (a.tier !== b.tier ? a.tier - b.tier : a.index - b.index))
    .map((x) => x.c);
}

/**
 * Mejor alternativa de swap para `target`, o null si no hay candidatos.
 */
export function bestSwapCandidate(target: Exercise, candidates: Exercise[]): Exercise | null {
  const ranked = rankSwapCandidates(target, candidates);
  return ranked.length > 0 ? ranked[0] : null;
}
