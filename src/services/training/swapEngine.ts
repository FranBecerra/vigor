/**
 * Motor de Sustitución en Cascada (Swap) — PRD §3.5.
 *
 * Dado el ejercicio a sustituir y un catálogo de candidatos, ordena las
 * alternativas bajo reglas algorítmicas descendentes:
 *   1. Vector de Movimiento Exacto (mismo MovementVector).           [tier 1]
 *   2. Grupo Muscular Principal (mismo primaryMuscle).               [tier 2]
 *   3. Resto (misma región pero sin coincidencia fuerte).            [tier 3]
 * Private variants use their actual classification, never a blanket penalty.
 * Within each tier, match recording convention, equipment, profile and laterality.
 *
 * Funciones puras (objetivo 100% cobertura).
 */
import type { Exercise } from '@/models';
import { primaryMusclesOf } from './exerciseMuscles';

/** Puntuación de prioridad de un candidato (menor = mejor). */
function tierOf(target: Exercise, candidate: Exercise): number {
  const vectors = target.movementVectors ?? [target.movementVector];
  const sameVector = (candidate.movementVectors ?? [candidate.movementVector]).some((vector) => vector !== 'UNCLASSIFIED' && vectors.includes(vector));
  const sameMuscle = primaryMusclesOf(candidate).some((muscle) => muscle !== 'UNCLASSIFIED' && primaryMusclesOf(target).includes(muscle));

  if (sameVector && sameMuscle) return 0;
  if (sameVector) return 1;
  if (sameMuscle) return 2;
  return 3;
}

/** Similarity, not a hypertrophy effectiveness score. Never penalise a useful private variant out of its natural tier. */
function similarity(target: Exercise, candidate: Exercise): number {
  return Number(target.equipment !== candidate.equipment) * 4
    + Number(target.profile !== candidate.profile) * 2
    + Number((target.recording?.measure ?? 'REPETITIONS') !== (candidate.recording?.measure ?? 'REPETITIONS')) * 8
    + Number((target.recording?.load ?? 'TOTAL_KG') !== (candidate.recording?.load ?? 'TOTAL_KG')) * 4
    + Number(target.laterality !== candidate.laterality);
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
    .sort((a, b) => a.tier - b.tier || similarity(target, a.c) - similarity(target, b.c) || a.index - b.index)
    .map((x) => x.c);
}

/**
 * Mejor alternativa de swap para `target`, o null si no hay candidatos.
 */
export function bestSwapCandidate(target: Exercise, candidates: Exercise[]): Exercise | null {
  const ranked = rankSwapCandidates(target, candidates);
  return ranked.length > 0 ? ranked[0] : null;
}
