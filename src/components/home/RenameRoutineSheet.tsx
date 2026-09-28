/**
 * Bottom sheet to rename a routine from the home (PRD §8.5).
 *
 * A sheet rather than `Alert.prompt`, which exists only on iOS.
 */
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/useTheme';
import {
  MAX_ROUTINE_NAME_LENGTH,
  normalizeRoutineName,
  routineNameProblem,
} from '@/services/training/routineMapper';

interface RenameRoutineSheetProps {
  /** Current name; null keeps the sheet closed. */
  currentName: string | null;
  /** Names of the athlete's OTHER routines, which this one may not repeat. */
  otherNames: readonly string[];
  labels: { title: string; save: string; cancel: string; duplicate: string };
  onSave: (name: string) => void;
  onClose: () => void;
}

export function RenameRoutineSheet({ currentName, otherNames, labels, onSave, onClose }: RenameRoutineSheetProps) {
  const { colors, typography, spacing, radius, sectionAccent, semantic } = useTheme();
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState('');

  useEffect(() => {
    if (currentName !== null) setValue(currentName);
  }, [currentName]);

  const name = normalizeRoutineName(value);
  const problem = routineNameProblem(value, otherNames);
  const canSave = problem === null && name !== currentName;
  const submit = () => {
    if (name !== null && canSave) onSave(name);
  };

  return (
    <Modal visible={currentName !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.bg,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              paddingBottom: insets.bottom + spacing.lg,
            },
          ]}>
          <View style={[styles.grabber, { backgroundColor: colors.surfaceBorder }]} />
          <Text style={[typography.h2, { color: colors.textPrimary }]}>{labels.title}</Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            maxLength={MAX_ROUTINE_NAME_LENGTH}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={submit}
            style={[
              typography.body,
              styles.input,
              {
                color: colors.textPrimary,
                backgroundColor: colors.surface,
                borderColor: colors.surfaceBorder,
                borderRadius: radius.md,
              },
            ]}
          />
          {problem === 'duplicate' ? (
            <Text style={[typography.caption, { color: semantic.danger, marginBottom: spacing.sm }]}>
              {labels.duplicate}
            </Text>
          ) : null}
          <View style={styles.actions}>
            <Pressable onPress={onClose} accessibilityRole="button" style={styles.button}>
              <Text style={[typography.body, { color: colors.textSecondary }]}>{labels.cancel}</Text>
            </Pressable>
            <Pressable
              onPress={submit}
              disabled={!canSave}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSave }}
              style={[
                styles.button,
                { backgroundColor: sectionAccent.train, borderRadius: radius.md, opacity: canSave ? 1 : 0.4 },
              ]}>
              <Text style={[typography.body, { color: '#16191C', fontWeight: '700' }]}>{labels.save}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { paddingHorizontal: 18, paddingTop: 10 },
  grabber: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  input: { height: 50, borderWidth: 1, paddingHorizontal: 14, marginVertical: 14 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  button: { paddingVertical: 11, paddingHorizontal: 16 },
});
