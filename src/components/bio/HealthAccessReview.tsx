import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';

/** HealthKit cannot redisplay already-decided read permissions or reveal their grants. */
export function HealthAccessReview({ onClose, onRequest, busy }: {
  onClose(): void; onRequest(): Promise<boolean | void>; busy: boolean;
}) {
  const { t } = useTranslation(), { colors, surfaces, typography, radius, semantic } = useTheme();
  const [result, setResult] = useState<'reviewed' | 'error' | null>(null);
  const alive = useRef(true), working = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const request = async () => {
    if (busy || working.current) return;
    working.current = true; setResult(null);
    try { const ok = await onRequest(); if (alive.current) setResult(ok === true ? 'reviewed' : 'error'); }
    catch { if (alive.current) setResult('error'); }
    finally { working.current = false; }
  };
  return <Modal transparent animationType="fade" onRequestClose={onClose}>
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.scrim }}>
      <View accessibilityViewIsModal style={{ ...surfaces.sheet, padding: 24, borderRadius: radius.lg, gap: 16 }}>
        <Text style={[typography.h2, { color: colors.textPrimary }]}>{t('healthAccess.title')}</Text>
        <Text style={[typography.body, { color: colors.textSecondary }]}>{t('healthAccess.explanation')}</Text>
        <Text style={[typography.title, { color: colors.textPrimary }]}>{t('healthAccess.path')}</Text>
        {result && <Text accessibilityRole={result === 'error' ? 'alert' : undefined} style={[typography.body, { color: result === 'error' ? semantic.warning : colors.textSecondary }]}>{t(`healthAccess.${result}`)}</Text>}
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => { void request(); }} style={{ minHeight: 48, justifyContent: 'center' }}>
          <Text style={[typography.title, { color: colors.accentText }]}>{t('healthAccess.request')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onClose} style={{ minHeight: 48, justifyContent: 'center' }}>
          <Text style={[typography.title, { color: colors.textPrimary }]}>{t('workout.done')}</Text>
        </Pressable>
      </View>
    </View>
  </Modal>;
}
