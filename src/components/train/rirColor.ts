/**
 * Escala de color del RIR (PRD §8.5).
 *
 * Rojo (0-1, cerca del fallo) → ámbar (2-3) → verde (4-5, lejos del fallo).
 * Coherente con los colores semánticos: rojo = límite/peligro.
 *
 * Función pura (objetivo 100% cobertura).
 */

/** Paleta de la escala, indexada por RIR 0..5. */
export const RIR_COLORS = [
  '#F2453D', // 0 — fallo
  '#F2643D', // 1
  '#F2B03A', // 2
  '#C7D84A', // 3
  '#6FD89E', // 4
  '#3FE0A9', // 5
] as const;

/**
 * Color para un valor de RIR. Valores fuera de 0..5 se recortan al extremo
 * más cercano (un RIR 8 informado a mano se muestra como el más "lejano").
 */
export function rirColor(rir: number): string {
  if (!Number.isFinite(rir)) {
    return RIR_COLORS[RIR_COLORS.length - 1];
  }
  const index = Math.min(Math.max(Math.round(rir), 0), RIR_COLORS.length - 1);
  return RIR_COLORS[index];
}
