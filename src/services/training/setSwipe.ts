/** Half-row swipes delete; a short reveal and reverse swipe never do. */
export function setSwipeDestination(offset: number, width: number): 'remove' | 'reveal' | 'close' {
  'worklet';
  if (!Number.isFinite(offset) || !Number.isFinite(width) || width <= 0) return 'close';
  if (offset <= -width * 0.5) return 'remove';
  return offset < -36 ? 'reveal' : 'close';
}
