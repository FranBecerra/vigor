export interface ExerciseMenuAnchor { x: number; y: number; width: number; height: number }
/** Keep contextual actions beside the rail, within the current safe viewport. */
export function exerciseMenuLayout(width: number, height: number, topInset: number, bottomInset: number, anchor?: ExerciseMenuAnchor) {
  const safeWidth = Math.max(160, width); const margin = 12; const menuWidth = Math.min(264, safeWidth - margin * 2);
  const available = Math.max(44, height - topInset - bottomInset - margin * 2);
  const maxHeight = Math.min(300, available);
  const x = anchor && Number.isFinite(anchor.x) ? anchor.x : margin;
  const below = anchor && Number.isFinite(anchor.y) && Number.isFinite(anchor.height) ? anchor.y + anchor.height + 6 : topInset + 160;
  return { width: menuWidth, maxHeight, left: Math.max(margin, Math.min(safeWidth - menuWidth - margin, x)),
    top: Math.max(topInset + margin, Math.min(height - bottomInset - maxHeight - margin, below)) };
}
