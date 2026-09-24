/**
 * Resolución de unidades según la región del usuario (PRD §8.6).
 *
 * expo-localization expone `measurementSystem` ('metric' | 'us' | 'uk' | null).
 * La app muestra kg o lb en consecuencia, sin preguntar al usuario.
 *
 * Funciones puras (objetivo 100% cobertura).
 */

export type MeasurementSystem = 'metric' | 'us' | 'uk' | null | undefined;
export type WeightUnit = 'kg' | 'lb';

const LB_PER_KG = 2.2046226218;

/**
 * Unidad de peso para un sistema de medida.
 * 'us' → lb; todo lo demás (metric, uk, desconocido) → kg.
 * Nota: UK usa stones/lb coloquialmente pero kg en gimnasio, así que → kg.
 */
export function weightUnitFor(system: MeasurementSystem): WeightUnit {
  return system === 'us' ? 'lb' : 'kg';
}

/** Convierte kg a la unidad indicada, redondeando a 1 decimal. */
export function convertWeight(kg: number, unit: WeightUnit): number {
  if (!Number.isFinite(kg) || kg < 0) {
    throw new Error('convertWeight: kg debe ser un número >= 0');
  }
  if (unit === 'kg') return Math.round(kg * 10) / 10;
  return Math.round(kg * LB_PER_KG * 10) / 10;
}

/** Convierte un valor en la unidad dada de vuelta a kg (almacenamiento canónico). */
export function toKilograms(value: number, unit: WeightUnit): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('toKilograms: value debe ser un número >= 0');
  }
  if (unit === 'kg') return Math.round(value * 10) / 10;
  return Math.round((value / LB_PER_KG) * 10) / 10;
}
