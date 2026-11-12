import { SplitStructure, type PlannedSessionFocus } from '@/models';

/** Name the presented roster, not the requested split. Labels remain caller-localized. */
export function generatedStructureName(focuses: readonly PlannedSessionFocus[], labels: {
  focus: (focus: PlannedSessionFocus) => string;
  split: (split: SplitStructure) => string;
  mixed: string;
}): string {
  const counts = new Map<PlannedSessionFocus, number>();
  focuses.forEach(focus => counts.set(focus === 'LEGS' ? 'LOWER' : focus, (counts.get(focus === 'LEGS' ? 'LOWER' : focus) ?? 0) + 1));
  if (!counts.size) return labels.mixed;
  if (counts.size === 1 && counts.has('FULL_BODY')) return labels.split(SplitStructure.FULL_BODY);
  if (counts.size === 2 && counts.has('UPPER') && counts.has('LOWER')) return labels.split(SplitStructure.UPPER_LOWER);
  if (counts.size === 3 && counts.has('PUSH') && counts.has('PULL') && counts.has('LOWER')) return labels.split(SplitStructure.PUSH_PULL_LEGS);
  return [...counts].map(([focus, count]) => `${labels.focus(focus)}${count > 1 && counts.size > 1 ? ` ×${count}` : ''}`).join(' + ');
}
