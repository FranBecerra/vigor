import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';

/** Cycle swipes belong to this header, never to editable exercise rows. */
export function RoutineSessionSelector({ cycle, cycles, sessions, selected, disabled, onSelect }: {
  cycle: number; cycles: number; sessions: readonly { plannedSessionIndex: number; name: string }[];
  selected: number; disabled: boolean; onSelect: (cycle: number, session: number) => void;
}) {
  const { t } = useTranslation(); const { colors, surfaces, radius } = useTheme();
  const scroll = useRef<ScrollView>(null);
  const positions = useRef(new Map<number, number>());
  useEffect(() => { scroll.current?.scrollTo({ x: Math.max(0, (positions.current.get(selected) ?? 0) - 16), animated: true }); }, [selected, cycle]);
  const move = (direction: number) => {
    const next = cycle + direction;
    if (!disabled && next >= 0 && next < cycles) onSelect(next, selected);
  };
  const swipe = Gesture.Pan().enabled(!disabled).activeOffsetX([-24, 24]).failOffsetY([-12, 12]).runOnJS(true)
    .onEnd(event => { if (Math.abs(event.translationX) >= 48) move(event.translationX < 0 ? 1 : -1); });
  return <View style={{ gap: 12, marginBottom: 20 }}>
    <GestureDetector gesture={swipe}>
      <View testID="routine-cycle-selector" style={{ flexDirection: 'row', alignItems: 'center', ...surfaces.card,
        backgroundColor: colors.accentTint, borderRadius: radius.lg, padding: 6, minHeight: 62 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('sharedRoutineEditor.previousCycle')}
          disabled={disabled || cycle <= 0} onPress={() => move(-1)}
          style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', opacity: cycle <= 0 ? .3 : 1 }}>
          <Text style={{ color: colors.accentText, fontSize: 30 }}>‹</Text>
        </Pressable>
        <Text accessibilityRole="header" style={{ flex: 1, textAlign: 'center', color: colors.textPrimary, fontSize: 20, fontWeight: '700' }}>
          {t('home.microcycle')} {cycle + 1}/{cycles}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('sharedRoutineEditor.nextCycle')}
          disabled={disabled || cycle >= cycles - 1} onPress={() => move(1)}
          style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', opacity: cycle >= cycles - 1 ? .3 : 1 }}>
          <Text style={{ color: colors.accentText, fontSize: 30 }}>›</Text>
        </Pressable>
      </View>
    </GestureDetector>
    <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {sessions.map(session => {
        const active = session.plannedSessionIndex === selected;
        return <Pressable key={session.plannedSessionIndex} accessibilityRole="tab" accessibilityLabel={session.name}
          accessibilityState={{ selected: active }} disabled={disabled}
          onLayout={event => { positions.current.set(session.plannedSessionIndex, event.nativeEvent.layout.x); }}
          onPress={() => onSelect(cycle, session.plannedSessionIndex)}
          style={{ minHeight: 48, paddingHorizontal: 16, justifyContent: 'center', borderRadius: radius.md,
            ...(active ? surfaces.field : {}), backgroundColor: active ? colors.accentTint : 'transparent',
            borderWidth: 1, borderColor: active ? colors.accentText : 'transparent' }}>
          <Text style={{ color: active ? colors.textPrimary : colors.textSecondary, fontSize: 17, fontWeight: active ? '700' : '500' }}>{session.name}</Text>
        </Pressable>;
      })}
    </ScrollView>
  </View>;
}
