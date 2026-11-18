import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { cardioWorkoutMetrics } from '@/services/cardio/cardioHealthReview';
import type { CardioHealthWorkout } from '@/models/cardioHealth';

export function AgendaActionSheet({ name, mode, onClose, start, skip, subtitle, onOpenHealth, health }: {
  name: string; mode: 'session' | 'health'; subtitle?: string;
  onClose(): void; start?: () => void; skip?: () => Promise<void>;
  onOpenHealth?: () => void;
  health?: { state: string; rows: CardioHealthWorkout[]; planned: string; load(authorize: boolean): void; save(id: string): Promise<void> };
}) {
  const { t, i18n } = useTranslation();
  const { colors, surfaces, semantic, radius } = useTheme();
  const [choice, setChoice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(false);
  const lock = useRef(false), live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const commit = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(false);
    try { await action(); if (live.current) onClose(); }
    catch { if (live.current) setError(true); }
    finally { if (live.current) { lock.current = false; setBusy(false); } }
  };
  const button = (label: string, onPress: () => void, primary = false, disabled = false) => <Pressable
    accessibilityRole="button" accessibilityLabel={label} disabled={busy || disabled} onPress={onPress}
    style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 12, borderRadius: radius.md,
      backgroundColor: primary ? surfaces.primary.backgroundColor : colors.surface, opacity: disabled ? .5 : 1 }}>
    <Text style={{ color: primary ? colors.onAccent : colors.accentText, fontSize: 16, fontWeight: '700', textAlign: primary ? 'center' : 'left' }}>{label}</Text>
  </Pressable>;
  const selected = health?.rows.find(row => row.id === choice);
  return <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { if (!busy) onClose(); }}>
    <ScrollView style={{ flex: 1, ...surfaces.sheet }} contentContainerStyle={{ padding: 22, paddingTop: 28, paddingBottom: 55, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text accessibilityRole="header" style={{ flex: 1, color: colors.textPrimary, fontSize: 24, fontWeight: '800' }}>
          {mode === 'session' ? name : t('trainingAgenda.linkHealth')}
        </Text>
        <Pressable accessibilityRole="button" onPress={onClose} disabled={busy} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={{ color: colors.accentText, fontSize: 16 }}>{t('generate.cancel')}</Text>
        </Pressable>
      </View>
      {mode === 'session' && <>
        {subtitle && <Text style={{ color: colors.textSecondary }}>{subtitle}</Text>}
        {start && button(t('routine.startSession'), start, true)}
        {skip && button(t('routine.skipSession'), () => void commit(skip))}
        {onOpenHealth && button(t('trainingAgenda.linkHealth'), onOpenHealth)}
      </>}
      {mode === 'health' && health && <>
        <Text style={{ color: colors.textSecondary }}>{name} · {health.planned}</Text>
        {(health.state === 'LOADING' || health.state === 'AUTHORIZING') && <ActivityIndicator />}
        {health.state === 'UNAVAILABLE' && <Text style={{ color: colors.textSecondary }}>{t('trainingAgenda.healthUnavailable')}</Text>}
        {health.state === 'IDLE' && button(t('trainingAgenda.reviewAccess'), () => health.load(true))}
        {(health.state === 'READY' || health.state === 'ERROR') && !health.rows.length && <>
          <Text style={{ color: colors.textSecondary }}>{t(health.state === 'ERROR' ? 'cardioHealth.ERROR' : 'trainingAgenda.noMatches')}</Text>
          {button(t('trainingAgenda.reviewAccess'), () => health.load(true))}
        </>}
        {health.rows.map(record => {
          const chosen = record.id === choice;
          const { averageHeartRateBpm } = cardioWorkoutMetrics(record);
          const timestamp = new Date(record.start).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' });
          const stats = [`${Math.round(record.durationSeconds / 60 * 10) / 10} min`,
            record.distanceMetres === undefined ? '' : `${(record.distanceMetres / 1000).toLocaleString(i18n.language, { maximumFractionDigits: 2 })} km`,
            averageHeartRateBpm ? t('cardioHealth.pulse', { bpm: averageHeartRateBpm }) : ''];
          return <Pressable key={record.id} accessibilityRole="radio" accessibilityState={{ checked: chosen }} disabled={busy} onPress={() => setChoice(record.id)}
            style={{ ...surfaces.field, backgroundColor: chosen ? colors.accentTint : colors.surface, padding: 13, gap: 4, borderRadius: radius.md }}>
            <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{t(`cardioHealth.kind_${record.kind}`)}{chosen ? ' ✓' : ''}</Text>
            <Text style={{ color: colors.textSecondary }}>{timestamp} · {record.sourceName}</Text>
            <Text style={{ color: colors.textSecondary }}>{stats.filter(Boolean).join(' · ')}</Text>
          </Pressable>;
        })}
        {health.rows.length > 0 && <>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t('trainingAgenda.linkDisclosure')}</Text>
          {button(t('trainingAgenda.confirmLink'), () => { if (selected) void commit(() => health.save(selected.id)); }, true, !selected)}
        </>}
      </>}
      {error && <Text accessibilityRole="alert" style={{ color: semantic.danger }}>{t(mode === 'health' ? 'trainingAgenda.linkFailed' : 'calendar.saveFailed')}</Text>}
    </ScrollView>
  </Modal>;
}
