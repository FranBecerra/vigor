/** Presentation-only diagrams. These never prescribe dose or constrain allocation. */
import { MuscleGroup, SplitStructure, type Equipment } from '@/models';
import { canonicalPplFocuses, type SessionFocus } from './sessionDistribution';
import type { BodyMapPaint } from './bodyMap';
import { sessionPalette } from '@/theme/tokens';

const UPPER = new Set([MuscleGroup.CHEST, MuscleGroup.LATS, MuscleGroup.MID_BACK, MuscleGroup.NECK,
  MuscleGroup.DELTS_FRONT, MuscleGroup.DELTS_LATERAL, MuscleGroup.DELTS_REAR,
  MuscleGroup.BICEPS, MuscleGroup.TRICEPS, MuscleGroup.FOREARMS]);
const PUSH = new Set([MuscleGroup.CHEST, MuscleGroup.DELTS_FRONT, MuscleGroup.DELTS_LATERAL, MuscleGroup.TRICEPS, MuscleGroup.QUADS]);
const PULL = new Set([MuscleGroup.LATS, MuscleGroup.MID_BACK, MuscleGroup.DELTS_REAR, MuscleGroup.NECK,
  MuscleGroup.BICEPS, MuscleGroup.FOREARMS, MuscleGroup.ERECTORS, MuscleGroup.HAMSTRINGS, MuscleGroup.GLUTES]);

export function splitDiagramSessions(split: SplitStructure, sessions: number): { focus: SessionFocus; color: string }[] {
  const count = Number.isFinite(sessions) ? Math.max(0, Math.min(7, Math.floor(sessions))) : 0;
  if (split === SplitStructure.AUTO) return [];
  const focuses: SessionFocus[] = split === SplitStructure.FULL_BODY
    ? Array.from({ length: count }, () => 'FULL_BODY')
    : split === SplitStructure.UPPER_LOWER
      ? Array.from({ length: count }, (_, index) => index % 2 ? 'LOWER' : 'UPPER')
      : canonicalPplFocuses(count);
  return focuses.map((focus, index) => ({ focus, color: sessionPalette[index] }));
}

export function splitDiagramPaint(split: SplitStructure, sessions: number): (muscle: MuscleGroup) => BodyMapPaint | null {
  const entries = splitDiagramSessions(split, sessions);
  return (muscle) => {
    if (muscle === MuscleGroup.UNCLASSIFIED) return null;
    // AUTO deliberately promises no fixed anatomy-to-day assignment before allocation.
    if (split === SplitStructure.AUTO) return null;
    const bands = entries.filter(({ focus }) => focus === 'FULL_BODY' ||
      (focus === 'UPPER' ? UPPER.has(muscle)
        : focus === 'LOWER' || focus === 'LEGS' ? !UPPER.has(muscle)
          : focus === 'PUSH' ? PUSH.has(muscle) : PULL.has(muscle))).map(({ color }) => color);
    return bands.length ? { color: bands[0], opacity: 1, ...(bands.length > 1 ? { bands } : {}) } : null;
  };
}

/** Sort translated display names without mutating the selection or catalogue order. */
export function sortEquipmentOptions(equipment: readonly Equipment[], label: (entry: Equipment) => string, locale = 'en'): Equipment[] {
  const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
  return [...equipment].sort((left, right) => collator.compare(label(left), label(right)) || left.localeCompare(right));
}
