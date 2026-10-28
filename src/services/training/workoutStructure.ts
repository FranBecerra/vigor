import type { Exercise } from '@/models';
import { isLiveSetCompleted, type SessionSetsByExercise } from './sessionMapper';
import { SetType } from '@/models';

export function cleanSupersets(order: readonly string[], groups: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(order.filter((id) => typeof groups[id] === 'string' && groups[id].length > 0
    && order.filter((other) => groups[other] === groups[id]).length > 1).map((id) => [id, groups[id]]));
}
export function linkSuperset(order: readonly string[], groups: Readonly<Record<string, string>>, id: string, partner: string): Record<string, string> {
  if (id === partner || !order.includes(id) || !order.includes(partner)) return cleanSupersets(order, groups);
  const group = groups[partner] ?? `superset:${partner}`;
  return cleanSupersets(order, { ...groups, [id]: group, [partner]: group });
}
export function unlinkSuperset(order: readonly string[], groups: Readonly<Record<string, string>>, id: string): Record<string, string> {
  const next = { ...groups }; delete next[id]; return cleanSupersets(order, next);
}
/** Each new physical completion can rest, including out-of-order work. */
export function supersetTransition(order: readonly string[], groups: Readonly<Record<string, string>>, sets: SessionSetsByExercise, id: string) {
  const members = order.filter((other) => groups[id] && groups[other] === groups[id]);
  const pending = (other: string) => (sets[other] ?? []).some((set) => set.setType !== SetType.WARMUP && !isLiveSetCompleted(set));
  const index = members.indexOf(id);
  if (index < 0) return { next: null, rest: true };
  const following = members.slice(index + 1).find(pending);
  const round = members.slice(0, index + 1).find(pending);
  return { next: following ?? round ?? null, rest: following === undefined };
}
export function removeWorkoutExercise(exercises: readonly Exercise[], sets: SessionSetsByExercise, id: string) {
  const next = { ...sets }; delete next[id];
  return { exercises: exercises.filter((exercise) => exercise.id !== id), sets: next };
}
