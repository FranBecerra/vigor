import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { moveItem } from '@/services/training/workoutReview';
import { useTheme } from '@/theme/useTheme';
import { RoutineDayList } from './RoutineDayList';
import { SwipeableSet } from './SwipeableSet';

const INITIAL = [
  { id: 'upper', kind: 'workout', name: 'Upper' },
  { id: 'rest-1', kind: 'rest', name: 'Rest' },
  { id: 'lower', kind: 'workout', name: 'Lower' },
  { id: 'rest-2', kind: 'rest', name: 'Rest' },
];

/** Native gesture acceptance only. Changes are discarded on unmount; no repositories. */
export function RoutineDayFixture() {
  const { colors, sectionAccent } = useTheme();
  const [days, setDays] = useState(INITIAL);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [skipped, setSkipped] = useState<Record<string, boolean>>({});
  const row = (day: typeof INITIAL[number]) => <Pressable accessibilityRole="checkbox" accessibilityLabel={`${day.name} ${day.id}`}
    accessibilityState={{ checked: checked[day.id] === true || skipped[day.id] === true }}
    onPress={() => { if (day.kind === 'rest') setChecked((old) => ({ ...old, [day.id]: !old[day.id] })); }}
    style={{ height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 12,
      backgroundColor: colors.bgElevated, borderBottomWidth: 1, borderColor: colors.surfaceBorder }}>
    <Text style={{ width: 48, fontSize: 11, color: colors.textMuted }}>—</Text>
    <Text style={{ flex: 1, fontSize: 16, color: colors.textPrimary, textDecorationLine: skipped[day.id] ? 'line-through' : 'none' }}>{day.name}</Text>
    <View style={{ width: 18, height: 18, borderWidth: 1.5, borderColor: colors.controlBorder, borderRadius: 6,
      backgroundColor: checked[day.id] || skipped[day.id] ? sectionAccent.train : 'transparent', alignItems: 'center' }}>
      {(checked[day.id] || skipped[day.id]) && <Text style={{ color: colors.onAccent, fontSize: 11 }}>✓</Text>}
    </View>
  </Pressable>;
  return <View>
    <Text style={{ color: colors.textSecondary, marginBottom: 16 }}>Hold and drag any day. Hold a workout to Skip. Swipe a rest to delete.</Text>
    <RoutineDayList items={days} onReorder={(from, to) => setDays((old) => moveItem(old, from, to))}
      onHold={(day) => { if (day.kind === 'workout') Alert.alert(day.name, undefined, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Skip', onPress: () => setSkipped((old) => ({ ...old, [day.id]: true })) },
      ]); }} renderItem={(day) => day.kind === 'rest'
        ? <SwipeableSet removeLabel={`Remove ${day.id}`} onRemove={() => setDays((old) => old.filter((item) => item.id !== day.id))}>{row(day)}</SwipeableSet>
        : row(day)} />
    <Pressable accessibilityRole="button" accessibilityLabel="Append fixture rest" onPress={() => setDays((old) => [...old,
      { id: `rest-${Date.now()}`, kind: 'rest', name: 'Rest' }])} style={{ minHeight: 48, justifyContent: 'center' }}>
      <Text style={{ color: colors.accentText }}>+ Rest</Text>
    </Pressable>
    <Text style={{ color: colors.textSecondary }}>Order: {days.map((day) => day.id).join(' → ')}</Text>
  </View>;
}
