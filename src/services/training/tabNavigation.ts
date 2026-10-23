/** Only destinations without inline drafts may be reset by reselecting Training. */
export function canResetTrainingTab(segments: readonly string[]): boolean {
  if (!segments.includes('(train)')) return false;
  const route = segments[segments.indexOf('(train)') + 1] ?? 'index';
  return ['index', 'exercises', 'history', 'performance', 'routine', 'mesocycle', 'create-routine'].includes(route);
}
