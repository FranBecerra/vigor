import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { editNumericDraft } from '@/services/training/workoutExecution';
import { parseNumericText } from '@/services/training/numericDraft';

/** Local text draft: incomplete numbers never mutate a neighbouring prescription. */
export function NumericKeypad({ label, value, decimal = false, onSave, onClose }: {
  label: string; value?: number; decimal?: boolean;
  onSave: (value: number | undefined) => void; onClose: () => void;
}) {
  const { colors, radius, sectionAccent } = useTheme(); const { t } = useTranslation();
  const insets = useSafeAreaInsets(); const [text, setText] = useState(value === undefined ? '' : String(value));
  const [replace, setReplace] = useState(true);
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}>
    <Pressable onPress={onClose} accessibilityLabel={t('generate.cancel')} style={{ flex: 1, backgroundColor: '#0007' }} />
    <View accessibilityViewIsModal style={{ backgroundColor: colors.bgElevated, padding: 16,
      paddingBottom: Math.max(12, insets.bottom), borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, gap: 8 }}>
      <Text style={{ color: colors.textSecondary, fontSize: 15 }}>{label}</Text>
      <Text style={{ color: colors.textPrimary, fontSize: 30, fontWeight: '700', textAlign: 'center', padding: 8 }}>{text || '—'}</Text>
      {['123', '456', '789', '.0⌫'].map((row) => <View key={row} style={{ flexDirection: 'row', gap: 8 }}>
        {[...row].map((key) => <Pressable key={key} accessibilityRole="button" accessibilityLabel={key === '⌫' ? t('workout.eraseDigit') : key}
          disabled={key === '.' && !decimal} onPress={() => {
            setText(editNumericDraft(replace && /^\d$/.test(key) ? '' : text, key === '⌫' ? 'backspace' : key, decimal)); setReplace(false);
          }} onLongPress={key === '⌫' ? () => { setText(''); setReplace(false); } : undefined}
          style={{ flex: 1, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.surface }}>
          <Text style={{ color: colors.textPrimary, fontSize: 24 }}>{key === '.' && !decimal ? '' : key}</Text>
        </Pressable>)}
      </View>)}
      <Pressable accessibilityRole="button" accessibilityLabel={t('workout.done')} onPress={() => { onSave(parseNumericText(text, decimal)); onClose(); }}
        style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: sectionAccent.train }}>
        <Text style={{ color: '#16191C', fontSize: 17, fontWeight: '700' }}>{t('workout.done')} ↵</Text>
      </Pressable>
    </View>
  </Modal>;
}
