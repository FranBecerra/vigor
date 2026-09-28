/**
 * Siglas de tipo de serie (PRD §8.5).
 *
 * Siglas UNIVERSALES, deliberadamente SIN traducir: son jerga internacional en
 * apps de fuerza, y traducirlas provocaba colisiones (en francés, Échauffement
 * y Échec colisionaban en "É").
 *
 * Función pura (objetivo 100% cobertura).
 */
import { SetType } from '@/models';

const LABELS: Record<SetType, string> = {
  [SetType.WARMUP]: 'W',
  [SetType.NORMAL]: '', // las normales muestran su número, no sigla
  [SetType.FAILURE]: 'F',
  [SetType.MYO_REP]: 'M',
  [SetType.DROP_SET]: 'DS',
  [SetType.REST_PAUSE]: 'RP',
  [SetType.TOP_SINGLE]: 'S',
};

/** Sigla del tipo de serie. Para NORMAL devuelve cadena vacía (usa el número). */
export function setTypeLabel(setType: SetType): string {
  return LABELS[setType];
}

/** Tipos de serie seleccionables, en el orden en que se muestran al usuario. */
export const SELECTABLE_SET_TYPES: readonly SetType[] = [
  SetType.WARMUP,
  SetType.NORMAL,
  SetType.FAILURE,
  SetType.MYO_REP,
  SetType.DROP_SET,
  SetType.REST_PAUSE,
];
