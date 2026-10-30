import type { RoutineIconKey } from '@/models/routine';

/** Unicode only: use platform artwork, never downloaded/custom emoji images. */
export const ROUTINE_EMOJI: Readonly<Record<RoutineIconKey, string>> = {
  planet: '🪐', comet: '☄️', moon: '🌙', sun: '☀️', star: '⭐', telescope: '🔭', constellation: '🌌',
  compass: '🧭', tower: '🗼', mountain: '🏔️', anchor: '⚓', sailboat: '⛵', wave: '🌊', pine: '🌲',
  leaf: '🍃', lightning: '⚡', diamond: '💎', shield: '🛡️', rocket: '🚀', satellite: '🛰️', ufo: '🛸',
  fire: '🔥', target: '🎯', stopwatch: '⏱️',
  // Retired identities stay renderable. Object-only approximations where Unicode has no exact equipment glyph.
  dumbbell: '🔩', barbell: '⚙️', kettlebell: '🔔', run: '👟', bike: '🚲', lighthouse: '🗼', bodyweight: '📍',
};

/** Defensive read boundary for old, missing or unknown persisted catalogue keys. */
export function routineEmoji(icon: unknown): string {
  return typeof icon === 'string' && Object.hasOwn(ROUTINE_EMOJI, icon)
    ? ROUTINE_EMOJI[icon as RoutineIconKey] : ROUTINE_EMOJI.planet;
}
