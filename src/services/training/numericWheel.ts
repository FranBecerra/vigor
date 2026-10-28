export const POUNDS_PER_KILOGRAM = 2.2046226218487757;
const precise = (value: number) => Math.round(value * 1e6) / 1e6;
export function displayLoad(value: number, unit: 'kg' | 'lb'): number {
  if (!Number.isFinite(value) || value < 0) throw Error('Invalid load');
  return precise(unit === 'lb' ? value * POUNDS_PER_KILOGRAM : value);
}
export function storedLoad(value: number, unit: 'kg' | 'lb'): number {
  if (!Number.isFinite(value) || value < 0) throw Error('Invalid load');
  return precise(unit === 'lb' ? value / POUNDS_PER_KILOGRAM : value);
}
/** Bounded wheel centred on the current number; first tick never changes it. */
export function wheelValues(value: number | undefined, step: number, maximum: number): number[] {
  if (!Number.isFinite(step) || step <= 0 || !Number.isFinite(maximum) || maximum <= 0) throw Error('Invalid wheel');
  const anchor = Math.max(0, Math.min(maximum, Number.isFinite(value) ? value! : 0));
  return [...new Set(Array.from({ length: 101 }, (_, index) => precise(Math.min(maximum, Math.max(0, anchor + (index - 50) * step)))))];
}
