import { Modal, Pressable, Text, View } from 'react-native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { useBioHistory } from '@/hooks/useBioHistory';
import type { useMicrocycleReviews } from '@/hooks/useMicrocycleReviews';
import { useTheme } from '@/theme/useTheme';
import { buildBioCycles, type BioCycle } from '@/services/bio/microcycleReview';
import { MicrocycleReviewSheet } from './MicrocycleReviewSheet';

/** A single native presentation host survives asynchronous loading and retry. */
export function MicrocycleReviewDialogContent({ id, uid, data, reviews, onClose }: {
  id: string; uid: string | null; data: ReturnType<typeof useBioHistory>; reviews: ReturnType<typeof useMicrocycleReviews>; onClose(): void;
}) {
  const { t } = useTranslation(), { colors, surfaces, radius } = useTheme();
  const [saving, setSaving] = useState(false);
  const ready = data.ready && reviews.ready, error = data.error || reviews.error;
  const previous = useRef<{ owner: string | null; cycle?: BioCycle }>({ owner: uid });
  if (previous.current.owner !== uid) previous.current = { owner: uid };
  const current = uid && ready && !error ? buildBioCycles(uid, data.plans, data.history, Date.now()).find(c => c.id === id && c.closed) : undefined;
  if (current) previous.current.cycle = current;
  // A transient read/review-save failure must not discard already entered answers.
  const cycle = current ?? (error ? previous.current.cycle : undefined);
  return <Modal transparent animationType="slide" onRequestClose={() => { if (!saving) onClose(); }}>
    {cycle ? <MicrocycleReviewSheet embedded cycleNumber={cycle.index + 1}
      initial={reviews.entries.find(r => r.id === id)?.answers ?? {}} onClose={onClose}
      onSave={async answers => { setSaving(true); try { await reviews.save(cycle, answers); } finally { setSaving(false); } }}
      onSkip={async () => { setSaving(true); try { await reviews.save(cycle, {}, 'DISMISSED'); } finally { setSaving(false); } }} /> :
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim }}>
      <View accessibilityViewIsModal style={{ ...surfaces.card, padding: 24, paddingBottom: 40, borderRadius: radius.lg, gap: 16 }}>
        <Text accessibilityRole={error ? 'alert' : undefined} style={{ color: colors.textPrimary, fontSize: 18 }}>{t(!ready ? 'bioMetricsRefreshing' : error ? 'bio.loadError' : 'bio.empty')}</Text>
        {ready && !reviews.error && <Pressable accessibilityRole="button" accessibilityLabel={t('bio.retry')} onPress={data.reload} style={{ minHeight: 48 }}>
          <Text style={{ color: colors.accentText }}>{t('bio.retry')}</Text></Pressable>}
        <Pressable accessibilityRole="button" accessibilityLabel={t('bio.close')} onPress={onClose} style={{ minHeight: 48 }}><Text style={{ color: colors.accentText }}>{t('bio.close')}</Text></Pressable>
      </View>
    </View>}
  </Modal>;
}
