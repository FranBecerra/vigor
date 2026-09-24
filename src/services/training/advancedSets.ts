/**
 * Series avanzadas: Rest Pause, MyoReps y Drop Set — LÓGICA PURA (PRD §8.8).
 *
 * Estas series no se describen con un solo número de repeticiones: son una serie
 * principal MÁS una secuencia de tramos extra (`SetExtension`). Este módulo
 * resuelve los totales sin perder la estructura.
 *
 * Decisión de diseño: las repeticiones principales y las de los tramos se
 * mantienen SEPARADAS en el modelo y solo se suman al calcular. Una serie de
 * 10 + 3 + 2 no equivale a una de 15 a efectos de estímulo, así que aplanarlas
 * en el almacenamiento perdería información irrecuperable.
 */
import { SetType, type SetExtension, type WorkoutSet } from '@/models';

/** Tipos de serie que admiten tramos extra. */
const EXTENDABLE_SET_TYPES: readonly SetType[] = [
  SetType.REST_PAUSE,
  SetType.MYO_REP,
  SetType.DROP_SET,
];

/**
 * ¿Este tipo de serie admite tramos extra?
 *
 * FAILURE no los admite: llevar una serie al fallo no genera tramos, solo marca
 * la intención con la que se ejecutó.
 */
export function supportsExtensions(setType: SetType): boolean {
  return EXTENDABLE_SET_TYPES.includes(setType);
}

/** ¿La serie tiene algún tramo extra registrado? */
export function hasExtensions(set: Pick<WorkoutSet, 'extensions'>): boolean {
  return (set.extensions?.length ?? 0) > 0;
}

/**
 * Peso efectivo de la serie principal en kg: el real si se registró, y si no el
 * objetivo previsto.
 */
export function mainWeight(
  set: Pick<WorkoutSet, 'actualWeight' | 'targetWeight'>,
): number {
  return set.actualWeight ?? set.targetWeight;
}

/**
 * Peso efectivo de un tramo en kg. Un tramo sin peso propio hereda el de la
 * serie principal (caso normal en Rest Pause y MyoReps).
 */
export function extensionWeight(
  set: Pick<WorkoutSet, 'actualWeight' | 'targetWeight'>,
  extension: SetExtension,
): number {
  return extension.weight ?? mainWeight(set);
}

/** Repeticiones efectivas de la serie principal (reales si existen, si no las previstas). */
export function mainReps(set: Pick<WorkoutSet, 'actualReps' | 'targetReps'>): number {
  return set.actualReps ?? set.targetReps;
}

/** Repeticiones TOTALES: la serie principal más todos sus tramos. */
export function totalReps(
  set: Pick<WorkoutSet, 'actualReps' | 'targetReps' | 'extensions'>,
): number {
  const extra = (set.extensions ?? []).reduce((sum, e) => sum + (e.reps ?? 0), 0);
  return mainReps(set) + extra;
}

/**
 * Carga total de la serie en kg·rep (tonelaje): Σ repeticiones × peso de cada
 * tramo, incluida la serie principal. Cada tramo usa su propio peso, lo que
 * hace que un Drop Set compute correctamente aunque baje el peso.
 */
export function totalVolumeLoad(
  set: Pick<WorkoutSet, 'actualReps' | 'targetReps' | 'actualWeight' | 'targetWeight' | 'extensions'>,
): number {
  const main = mainReps(set) * mainWeight(set);
  const extra = (set.extensions ?? []).reduce(
    (sum, e) => sum + (e.reps ?? 0) * extensionWeight(set, e),
    0,
  );
  return main + extra;
}

/**
 * Repeticiones en formato compacto para la tabla: `10` en una serie normal,
 * `10+3+2` cuando hay tramos.
 */
export function formatReps(
  set: Pick<WorkoutSet, 'actualReps' | 'targetReps' | 'extensions'>,
): string {
  const parts = [
    String(mainReps(set)),
    ...(set.extensions ?? []).map((extension) =>
      extension.reps === undefined ? '—' : String(extension.reps),
    ),
  ];
  return parts.join('+');
}

/**
 * Describe los cambios de peso de los tramos, para un Drop Set: `60 → 50 → 40`.
 * Devuelve `null` cuando ningún tramo cambia el peso, de modo que la interfaz
 * pueda omitir la línea en Rest Pause y MyoReps.
 */
export function formatWeightProgression(
  set: Pick<WorkoutSet, 'actualWeight' | 'targetWeight' | 'extensions'>,
): string | null {
  const extensions = set.extensions ?? [];
  if (!extensions.some((e) => e.weight !== undefined)) return null;
  const weights = [mainWeight(set), ...extensions.map((e) => extensionWeight(set, e))];
  return weights.join(' → ');
}
