import type { router } from 'expo-router';

/** Preserve existing history; a directly opened screen must still have an exit. */
export function backToTraining(navigation: Pick<typeof router, 'canGoBack' | 'back' | 'replace'>): void {
  if (navigation.canGoBack()) navigation.back();
  else navigation.replace('/(tabs)/(train)');
}
