import { useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme/useTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCardioHealthReview } from '@/hooks/useCardioHealthReview';
import { CardioHealthReviewPanel } from '@/components/cardio/CardioHealthReviewPanel';
import type { CardioHealthBridge, CardioHealthWorkout } from '@/models/cardioHealth';
import { CardioPlanBuilder } from '@/components/cardio/CardioPlanBuilder';
import type { ReviewedCardioStart } from '@/services/cardio/reviewedCardioStart';
import { saveCardioProposal } from '@/services/cardio/savedCardioPlan';

/** Synthetic native acceptance: no real Health bridge, permission or account write. */
export default function CardioHealthCheck() {
  const router = useRouter(), { colors, surfaces } = useTheme(), insets = useSafeAreaInsets();
  const [scenario, setScenario] = useState<'RECORDS' | 'BASELINE' | 'EMPTY' | 'ERROR' | 'UNAVAILABLE' | 'TRUNCATED'>('RECORDS');
  const latest = useRef(scenario); latest.current = scenario;
  const bridge = useMemo<CardioHealthBridge>(() => ({
    available: async () => latest.current !== 'UNAVAILABLE', authorize: async () => undefined,
    read: async (_start, now) => {
      if (latest.current === 'ERROR') throw Error('synthetic');
      if (latest.current !== 'RECORDS' && latest.current !== 'BASELINE') return { version: 1, truncated: latest.current === 'TRUNCATED', workouts: [] };
      const workout = (id: string, days: number, source: string, patch: Partial<CardioHealthWorkout> = {}): CardioHealthWorkout => ({
        id, kind: 'RUNNING', start: now - days * 86400000, end: now - days * 86400000 + 1800000,
        durationSeconds: 1800, distanceMetres: 5000, sourceId: source, sourceName: source === 'watch' ? 'Watch fixture' : 'Partner fixture',
        manuallyEntered: false, ownExport: false, mixedActivities: false, ...patch });
      if (latest.current === 'BASELINE') return { version: 1, truncated: false,
        workouts: [1, 4, 8, 11, 15, 18, 22, 25].map(days => workout(`baseline-${days}`, days, 'watch')) };
      return { version: 1, truncated: false, workouts: [workout('run-a', 2, 'watch'), workout('run-b', 2, 'partner'),
        workout('run-c', 5, 'watch'), workout('manual', 7, 'watch', { manuallyEntered: true }),
        workout('bike', 10, 'watch', { kind: 'CYCLING', durationSeconds: 1200, distanceMetres: undefined })] };
    },
  }), []);
  const review = useCardioHealthReview(bridge);
  const [baseline, setBaseline] = useState<ReviewedCardioStart | null>(null), [saved, setSaved] = useState(false);
  if (saved) return <View style={{ flex: 1, ...surfaces.screen, padding: 24, justifyContent: 'center' }}>
    <Text style={{ color: colors.textPrimary }}>Synthetic plan accepted in memory only. No account write.</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Fixture return" onPress={() => { setSaved(false); setBaseline(null); }} style={{ padding: 16, minHeight: 48 }}>
      <Text style={{ color: colors.accentText }}>Return to fixture</Text>
    </Pressable></View>;
  if (baseline) return <CardioPlanBuilder initialBaseline={baseline} ready error={false} onRetry={() => undefined} onCancel={() => setBaseline(null)}
    onSave={async (name, input, accepted) => { saveCardioProposal('synthetic', 'synthetic-owner', name, input, null, Date.now(), accepted); setSaved(true); }} />;
  return <View style={{ flex: 1, ...surfaces.screen, paddingTop: insets.top }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16 }}>{(['RECORDS', 'BASELINE', 'EMPTY', 'ERROR', 'UNAVAILABLE', 'TRUNCATED'] as const).map(value => <Pressable key={value}
      accessibilityRole="button" accessibilityLabel={`Fixture ${value}`} onPress={() => { review.clear(); setScenario(value); }} style={{ minHeight: 44, padding: 8 }}>
      <Text style={{ color: colors.accentText, fontSize: 13 }}>{value}</Text>
    </Pressable>)}</View>
    <CardioHealthReviewPanel state={review.state} data={review.data} observedAt={review.observedAt} onRead={() => { void review.read(); }} onClear={review.clear}
      onPlan={value => { review.clear(); setBaseline(value); }}
      onClose={() => { review.clear(); if (router.canGoBack()) router.back(); else router.replace('/(tabs)/(train)'); }} />
  </View>;
}
