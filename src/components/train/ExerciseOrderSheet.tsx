import { useRef, useState } from 'react';
import { Modal, PanResponder, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { Exercise } from '@/models';
import { useTheme } from '@/theme/useTheme';
import { moveItem } from '@/services/training/workoutReview';
import { MusclePicture } from './MusclePicture';

const HEIGHT = 76;
function DragRow({ exercise, index, onMove, onDragging, last }: { exercise: Exercise; index: number; last: boolean;
  onMove: (from: number, to: number) => void; onDragging: (value: boolean) => void }) {
  const { colors, sectionAccent, radius } = useTheme(); const { t } = useTranslation();
  const [dy, setDy] = useState(0); const [dragging, setDragging] = useState(false);
  const current = useRef({ index, onMove, onDragging }); current.current = { index, onMove, onDragging };
  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { setDragging(true); current.current.onDragging(true); },
    onPanResponderMove: (_, gesture) => setDy(gesture.dy),
    onPanResponderRelease: (_, gesture) => {
      current.current.onMove(current.current.index, current.current.index + Math.round(gesture.dy / HEIGHT));
      setDy(0); setDragging(false); current.current.onDragging(false);
    },
    onPanResponderTerminate: () => { setDy(0); setDragging(false); current.current.onDragging(false); },
    onPanResponderTerminationRequest: () => false,
  })).current;
  return <View style={{ height: HEIGHT, paddingVertical: 4, zIndex: dragging ? 10 : 0, transform: [{ translateY: dy }] }}>
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10,
      borderWidth: 1, borderColor: dragging ? sectionAccent.train : colors.surfaceBorder, backgroundColor: colors.bgElevated, borderRadius: radius.md }}>
      <MusclePicture muscle={exercise.primaryMuscle} /><Text numberOfLines={2} style={{ flex: 1, color: colors.textPrimary, fontWeight: '600' }}>{exercise.name}</Text>
      <Pressable disabled={index === 0} onPress={() => onMove(index, index - 1)} accessibilityLabel={t('workout.moveUp')} style={{ padding: 8 }}><Text style={{ color: colors.textSecondary }}>↑</Text></Pressable>
      <Pressable disabled={last} onPress={() => onMove(index, index + 1)} accessibilityLabel={t('workout.moveDown')} style={{ padding: 8 }}><Text style={{ color: colors.textSecondary }}>↓</Text></Pressable>
      <View {...responder.panHandlers} accessible accessibilityLabel={t('workout.dragExercise')} style={{ padding: 12 }}>
        <Text style={{ color: colors.accentText, fontSize: 24 }}>≡</Text>
      </View>
    </View>
  </View>;
}

export function ExerciseOrderSheet({ open, exercises, onChange, onClose }: { open: boolean; exercises: Exercise[];
  onChange: (exercises: Exercise[]) => void; onClose: () => void }) {
  const { colors, typography, spacing, sectionAccent } = useTheme(); const { t } = useTranslation();
  const insets = useSafeAreaInsets(); const [dragging, setDragging] = useState(false);
  return <Modal visible={open} animationType="slide" onRequestClose={onClose}>
    <View style={{ flex: 1, paddingTop: insets.top + spacing.lg, paddingHorizontal: spacing.lg, backgroundColor: colors.bg }}>
      <Text style={[typography.emphasis, { color: colors.textPrimary }]}>{t('workout.order')}</Text>
      <Text style={{ color: colors.textMuted, marginVertical: 12 }}>{t('workout.dragHint')}</Text>
      <ScrollView scrollEnabled={!dragging} removeClippedSubviews={false}>
        {exercises.map((exercise, index) => <DragRow key={exercise.id} exercise={exercise} index={index} last={index === exercises.length - 1}
          onDragging={setDragging} onMove={(from, to) => onChange(moveItem(exercises, from, Math.max(0, Math.min(exercises.length - 1, to))))} />)}
      </ScrollView>
      <Pressable onPress={onClose} style={{ padding: 18, marginBottom: insets.bottom + 12, borderRadius: 24, backgroundColor: sectionAccent.train }}>
        <Text style={{ textAlign: 'center', color: colors.onAccent, fontWeight: '700' }}>{t('workout.done')}</Text>
      </Pressable>
    </View>
  </Modal>;
}
