/** Display bands for the existing experimental index, never clinical recovery thresholds. */
export type ReadinessBand = 'GREEN' | 'YELLOW' | 'ORANGE' | 'UNKNOWN';
export function readinessBand(score: number | undefined): ReadinessBand {
  if (score === undefined || !Number.isFinite(score) || score < 0 || score > 100) return 'UNKNOWN';
  return score === 100 ? 'GREEN' : score >= 75 ? 'YELLOW' : 'ORANGE';
}

/** Text-safe colours on Subtle surfaces; colour is always accompanied by a label. */
export const readinessInk = {
  light: { GREEN: '#28623F', YELLOW: '#775900', ORANGE: '#984200', UNKNOWN: '#556358' },
  dark: { GREEN: '#B0E65C', YELLOW: '#F2D270', ORANGE: '#FFB17C', UNKNOWN: '#AEBBB0' },
} as const;
