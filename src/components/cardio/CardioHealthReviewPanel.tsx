import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/useTheme';
import type { CardioHealthState } from '@/hooks/useCardioHealthReview';
import type { CardioHealthRead } from '@/models/cardioHealth';
import { reviewCardioHealth } from '@/services/cardio/cardioHealthReview';
import { CheckIcon } from '@/components/icons/ActionIcons';
import { CardioStartingPointPanel } from './CardioStartingPointPanel';
import type { ReviewedCardioStart } from '@/services/cardio/reviewedCardioStart';

export interface CardioHealthPanelProps {
  state: CardioHealthState; data?: CardioHealthRead; observedAt?: number;
  onRead(): void; onClear(): void; onClose(): void;
  onPlan?: (baseline: ReviewedCardioStart) => void;
}
export function CardioHealthReviewPanel(props: CardioHealthPanelProps) {
  // Fresh native reads reset source selection, exclusions and the ephemeral confirmation.
  return <OwnedReview key={`${props.state}:${props.observedAt ?? ''}`} {...props} />;
}
function OwnedReview({ state, data, observedAt, onRead, onClear, onClose, onPlan }: CardioHealthPanelProps) {
  const { t } = useTranslation(), { colors, surfaces, radius, semantic, sectionAccent } = useTheme(), insets = useSafeAreaInsets();
  const [sourceId, setSourceId] = useState<string>(), [excluded, setExcluded] = useState<string[]>([]), [confirmed, setConfirmed] = useState(false);
  const [visibleRows, setVisibleRows] = useState(20);
  const review = useMemo(() => data && observedAt ? reviewCardioHealth(data, observedAt, sourceId, excluded) : null, [data, observedAt, sourceId, excluded]);
  const busy = state === 'AUTHORIZING' || state === 'LOADING';
  const text = { color: colors.textPrimary, fontSize: 17 }, caption = { color: colors.textSecondary, fontSize: 14, lineHeight: 21 };
  const card = { ...surfaces.card, padding: 18, borderRadius: radius.lg, marginBottom: 14, gap: 10 };
  const action = (label: string, onPress: () => void, disabled = false, primary = false) => <Pressable key={label} accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={{ minHeight: 48, padding: 14, marginTop: 8, borderRadius: radius.md,
      ...(primary ? surfaces.primary : surfaces.field), justifyContent: 'center', alignItems: 'center', opacity: disabled ? 0.45 : 1 }}>
    <Text style={{ ...text, fontWeight: '600', color: primary ? colors.onAccent : colors.accentText }}>{label}</Text>
  </Pressable>;
  const count = (key: string, value: number) => value > 0 ? <Text key={key} style={caption}>{t(`cardioHealth.${key}`, { count: value })}</Text> : null;
  return <View style={{ ...surfaces.screen, flex: 1, paddingTop: insets.top }}>
    <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: insets.bottom + 30 }}>
      {action(t('generate.back'), onClose)}
      <Text accessibilityRole="header" style={{ ...text, fontSize: 29, fontWeight: '700', marginVertical: 22 }}>{t('cardioHealth.title')}</Text>
      <Text style={{ ...caption, marginBottom: 18 }}>{t('cardioHealth.intro')}</Text>
      {state === 'IDLE' && <View style={card}>
        <Text style={text}>{t('cardioHealth.privacy')}</Text>
        <Text style={caption}>{t('cardioHealth.permission')}</Text>
        {action(t('cardioHealth.connect'), onRead, false, true)}
      </View>}
      {busy && <View style={card}><ActivityIndicator color={colors.accentText} /><Text style={text}>{t(`cardioHealth.${state}`)}</Text>
        {action(t('cardioHealth.clear'), onClear)}</View>}
      {(state === 'ERROR' || state === 'UNAVAILABLE') && <View style={card}>
        <Text accessibilityRole="alert" style={{ ...text, color: semantic.warning }}>{t(`cardioHealth.${state}`)}</Text>
        {action(t('home.retry'), onRead)}
      </View>}
      {review && <>
        <View style={card}>
          <Text style={{ ...text, fontWeight: '600' }}>{t('cardioHealth.window', { start: new Date(review.start).toLocaleDateString(), end: new Date(review.end).toLocaleDateString() })}</Text>
          <Text style={caption}>{t('cardioHealth.incompleteAccess')}</Text>
          {review.limited && <Text accessibilityRole="alert" style={{ ...caption, color: semantic.warning }}>{t('cardioHealth.limited')}</Text>}
          {review.truncated && <Text accessibilityRole="alert" style={{ ...text, color: semantic.warning }}>{t('cardioHealth.truncated')}</Text>}
          {count('duplicates', review.duplicateCount)}{count('ownExports', review.ownCount)}{count('manual', review.manualCount)}{count('mixed', review.mixedCount)}
          {count('invalid', review.invalidCount + review.conflictingCount)}
        </View>
        {review.sources.length > 1 && <View style={card}>
          <Text style={{ ...text, fontWeight: '600' }}>{t('cardioHealth.sources')}</Text>
          {[{ id: undefined, name: t('cardioHealth.allSources') }, ...review.sources].map(source => <Pressable key={source.id ?? 'all'} accessibilityRole="radio"
            accessibilityLabel={source.name} accessibilityState={{ selected: sourceId === source.id }}
            onPress={() => { setSourceId(source.id); setExcluded([]); setConfirmed(false); setVisibleRows(20); }}
            style={{ minHeight: 48, padding: 14, borderRadius: radius.md, backgroundColor: sourceId === source.id ? colors.accentTint : 'transparent' }}>
            <Text style={{ ...text, fontWeight: sourceId === source.id ? '700' : '400' }}>{source.name}</Text>
          </Pressable>)}
        </View>}
        {!!review.overlappingIds.length && <View style={card}>
          <Text accessibilityRole="alert" style={{ ...text, color: semantic.warning }}>{t('cardioHealth.overlap')}</Text>
        </View>}
        {!review.groups.length && !review.truncated && <Text style={{ ...text, marginVertical: 20 }}>{t(review.rows.length ? 'cardioHealth.noCounted' : 'cardioHealth.empty')}</Text>}
        {review.groups.map(group => <View key={group.kind} style={card}>
          <Text style={{ ...text, fontWeight: '700', fontSize: 21 }}>{t(`cardioHealth.kind_${group.kind}`)}</Text>
          <Text style={text}>{t('cardioHealth.summary', { count: group.sessions, minutes: Math.round(group.minutes) })}</Text>
          <Text style={caption}>{t('cardioHealth.frequency', { value: Math.round(group.observedSessionsPerWeek * 10) / 10 })}</Text>
          <Text style={caption}>{t('cardioHealth.longest', { minutes: Math.round(group.longestMinutes) })}</Text>
          {group.distanceMetres !== null && <Text style={caption}>{t('cardioHealth.distance', { km: Math.round(group.distanceMetres / 100) / 10, count: group.distanceSessions })}</Text>}
        </View>)}
        {!!review.rows.length && <Text style={{ ...text, fontWeight: '700', marginVertical: 16 }}>{t('cardioHealth.sessions')}</Text>}
        {review.rows.slice(0, visibleRows).map(row => {
          const disabled = row.manuallyEntered || row.mixedActivities, selected = !excluded.includes(row.id);
          return <View key={row.id} style={card}>
            <Text style={{ ...text, fontWeight: '600' }}>{t(`cardioHealth.kind_${row.kind}`)}</Text>
            <Text style={caption}>{new Date(row.start).toLocaleString()} · {Math.round(row.durationSeconds / 60)} min</Text>
            <Text style={caption}>{row.sourceName}</Text>
            {row.distanceMetres !== undefined && <Text style={caption}>{Math.round(row.distanceMetres / 100) / 10} km</Text>}
            {row.manuallyEntered && <Text style={caption}>{t('cardioHealth.manualRow')}</Text>}
            {row.mixedActivities && <Text style={caption}>{t('cardioHealth.mixedRow')}</Text>}
            {review.overlappingIds.includes(row.id) && <Text style={{ ...caption, color: semantic.warning }}>{t('cardioHealth.overlapRow')}</Text>}
            {!disabled && <Pressable accessibilityRole="checkbox" accessibilityLabel={t('cardioHealth.include', { activity: t(`cardioHealth.kind_${row.kind}`), date: new Date(row.start).toLocaleString(), source: row.sourceName })}
              accessibilityState={{ checked: selected }} onPress={() => { setExcluded(old => selected ? [...old, row.id] : old.filter(id => id !== row.id)); setConfirmed(false); }}
              style={{ minHeight: 48, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <View accessible={false} style={{ width: 26, height: 26, borderRadius: 7, borderWidth: 1.5, borderColor: colors.accentText,
                backgroundColor: selected ? sectionAccent.train : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                {selected && <CheckIcon size={18} color={colors.onAccent} />}
              </View><Text style={{ ...text, color: colors.accentText }}>{t('cardioHealth.includeShort')}</Text></Pressable>}
          </View>;
        })}
        {review.rows.length > visibleRows && action(t('cardioHealth.more'), () => setVisibleRows(value => value + 20))}
        <Text style={{ ...caption, marginVertical: 12 }}>{t('cardioHealth.noPrescription')}</Text>
        {action(t('cardioHealth.confirm'), () => setConfirmed(true), !review.canConfirm, true)}
        {confirmed && <Text accessibilityRole="alert" style={{ ...text, marginVertical: 12 }}>{t('cardioHealth.confirmed')}</Text>}
        {confirmed && review.canConfirm && data && observedAt && <CardioStartingPointPanel data={data} observedAt={observedAt} sourceId={sourceId} excludedIds={excluded} onPlan={onPlan} />}
        {action(t('cardioHealth.refresh'), onRead)}
        {action(t('cardioHealth.clear'), onClear)}
      </>}
    </ScrollView>
  </View>;
}
