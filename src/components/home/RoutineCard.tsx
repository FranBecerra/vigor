/**
 * Subtle routine accordion (PRD §8.5): status on the left, session metadata in
 * the middle and working sets on the right. Real dates live in the subtitle;
 * pending sessions have no invented calendar date. Existing row actions and
 * the fixed-height reorder slots are preserved.
 */
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { RoutineBadgeIcon } from '@/components/icons/RoutineBadgeIcon';
import { MesoRail } from './HomeHeader';
import { useTheme } from '@/theme/useTheme';
import { rankedMuscleVolume, totalWorkingSets } from '@/services/training/sessionSummary';
import { RoutineDayIndicator } from './RoutineDayIndicator';
import type { MockRoutine } from '@/mocks/home';
import type { ReactNode } from 'react';

/** Formatea `2026-09-16` como `16 SEP`, en el idioma activo. */
export function formatSessionDate(iso: string, locale: string): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '—';
  const day = date.getDate();
  const month = date.toLocaleDateString(locale, { month: 'short' }).replace('.', '');
  return `${day} ${month.toUpperCase()}`;
}

interface RoutineCardProps {
  routine: MockRoutine;
  expanded: boolean;
  selectedSessionId: string;
  locale: string;
  muscleLabel: (muscle: string) => string;
  labels: {
    sessions: string;
    sets: string;
    today: string;
    viewMesocycle: string;
    microcycleOf: string;
    activate: string;
    rename: string;
    remove: string;
    active: string;
    skipped: string;
    identity?: string;
  };
  onToggle: () => void;
  onPressDetail: () => void;
  /** Absent on an inactive routine: its sessions are shown, not started. */
  onSelectSession?: (sessionId: string) => void;
  onLongPressSession?: (sessionIndex: number) => void;
  onPressMesocycle: () => void;
  /** Absent on the active routine. */
  onActivate?: () => void;
  onRename: () => void;
  onIdentity?: () => void;
  onRemove: () => void;
  renderSessionList?: (rows: readonly { index: number; content: ReactNode }[]) => ReactNode;
}

export function RoutineCard({
  routine,
  expanded,
  selectedSessionId,
  locale,
  muscleLabel,
  labels,
  onToggle,
  onPressDetail,
  onSelectSession,
  onLongPressSession,
  onPressMesocycle,
  onActivate,
  onRename,
  onIdentity,
  onRemove,
  renderSessionList,
}: RoutineCardProps) {
  const { surfaces, colors, sectionAccent, semantic, radius, spacing } = useTheme();
  const current = routine.microcycles[routine.currentMicrocycleIndex];
  const accent = sectionAccent.train;

  return (
    <View
      style={[
        styles.card,
        { ...surfaces.card, backgroundColor: colors.bgElevated, borderRadius: radius.lg },
        !expanded && styles.collapsed,
      ]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={labels.identity ?? labels.rename} disabled={!onIdentity}
          onPress={event => { event?.stopPropagation(); onIdentity?.(); }}
          testID="routine-card-identity" style={[styles.iconBadge, { backgroundColor: colors.accentTint, borderRadius: radius.sm }]}>
          <RoutineBadgeIcon icon={routine.icon} size={26} />
        </Pressable>
        <Pressable onPress={onPressDetail} accessibilityRole="button" accessibilityState={{ expanded }}
          accessibilityLabel={routine.name} style={styles.headerText}>
          <Text style={[styles.routineName, { color: colors.textPrimary }]}>{routine.name}</Text>
          <Text style={[styles.routineMeta, { color: colors.textMuted }]}>
            {routine.isActive ? `${labels.active} · ` : ''}
            {routine.objective} · {current.sessions.length} {labels.sessions}
          </Text>
        </Pressable>
        <Pressable onPress={(event) => { event.stopPropagation(); onToggle(); }}
          accessibilityRole="button" accessibilityLabel={labels.sessions}>
          <Text style={[styles.chevron, { color: colors.textMuted, padding: 12 }]}>{expanded ? '▲' : '▼'}</Text>
        </Pressable>
      </View>

      {expanded ? (
        <Animated.View entering={FadeIn.duration(140)} exiting={FadeOut.duration(100)}>
          <View style={{ marginTop: spacing.sm }}>
            <MesoRail
              microcycles={routine.microcycles}
              currentIndex={routine.currentMicrocycleIndex}
              caption={`${labels.microcycleOf} ${current.number}/${routine.microcycles.length}`}
              actionLabel={labels.viewMesocycle}
              onPress={onPressMesocycle}
            />
          </View>

          <View style={[styles.sessionList, { borderTopColor: colors.surfaceBorder }]}>
            {(() => { const rows = current.sessions.map((session) => {
              const isCompleted = session.completedOn !== undefined;
              const isSkipped = !isCompleted && session.skippedOn !== undefined;
              const isSelected = session.id === selectedSessionId;
              const displayedExercises = isCompleted ? session.performedExercises ?? session.exercises : session.exercises;
              const workingSets = totalWorkingSets(displayedExercises);
              const muscles = rankedMuscleVolume(displayedExercises, 3)
                .map((entry) => muscleLabel(entry.muscle))
                .join(' · ');
              const status = isCompleted ? formatSessionDate(session.completedOn!, locale)
                : isSkipped ? labels.skipped : isSelected ? labels.today : '';
              const subtitle = [status, isSkipped ? '' : muscles].filter(Boolean).join(' · ');

              return { index: session.plannedSessionIndex, content: (
                <Pressable
                  key={session.id}
                  onPress={onSelectSession === undefined ? undefined : () => onSelectSession(session.id)}
                  onLongPress={onLongPressSession && !isCompleted && !isSkipped ? () => onLongPressSession(session.plannedSessionIndex) : undefined}
                  disabled={onSelectSession === undefined}
                  accessibilityRole="button"
                  accessibilityLabel={[session.name, subtitle, `${workingSets} ${labels.sets}`].filter(Boolean).join(', ')}
                  accessibilityState={{ selected: isSelected, disabled: onSelectSession === undefined }}
                  style={[
                    styles.sessionRow,
                    { borderBottomColor: colors.surfaceBorder, backgroundColor: colors.bgElevated },
                    isSelected && { backgroundColor: colors.accentTint },
                  ]}>
                  <RoutineDayIndicator completed={isCompleted || isSkipped} />
                  <View style={styles.sessionText}>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.sessionName,
                        { color: isSelected ? colors.accentText : isCompleted || isSkipped ? colors.textSecondary : colors.textPrimary },
                        isSkipped && { textDecorationLine: 'line-through' },
                      ]}>
                      {session.name}
                    </Text>
                    <Text numberOfLines={1} style={[styles.sessionMuscles, { color: colors.textMuted }]}>
                    {subtitle}
                    </Text>
                  </View>

                  <View style={styles.setCount}>
                    <Text style={[styles.setCountValue, { color: isSelected ? colors.accentText : colors.textPrimary }]}>{workingSets}</Text>
                    <Text style={[styles.setCountLabel, { color: colors.textSecondary }]}>{labels.sets}</Text>
                  </View>
                </Pressable>
              ) };
            }); return renderSessionList ? renderSessionList(rows) : rows.map((row) => row.content); })()}
          </View>

          <View style={[styles.actions, { marginTop: spacing.sm }]}>
            {/* Destructive action kept apart, on the left, away from the primary one. */}
            <Pressable
              onPress={onRemove}
              accessibilityRole="button"
              accessibilityLabel={labels.remove}
              style={[styles.actionButton, styles.removeButton, { borderColor: colors.surfaceBorder, borderRadius: radius.sm }]}>
              <Text style={[styles.actionText, { color: semantic.danger }]}>{labels.remove}</Text>
            </Pressable>
            <Pressable
              onPress={onRename}
              accessibilityRole="button"
              accessibilityLabel={labels.rename}
              style={[styles.actionButton, { borderColor: colors.surfaceBorder, borderRadius: radius.sm }]}>
              <Text style={[styles.actionText, { color: colors.textSecondary }]}>{labels.rename}</Text>
            </Pressable>
            {onActivate !== undefined ? (
              <Pressable
                onPress={onActivate}
                accessibilityRole="button"
                accessibilityLabel={labels.activate}
                style={[styles.actionButton, { backgroundColor: accent, borderColor: accent, borderRadius: radius.sm }]}>
                <Text style={[styles.actionText, { color: '#16191C' }]}>{labels.activate}</Text>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16 },
  collapsed: { opacity: 0.72 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBadge: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  routineName: { fontSize: 19, fontWeight: '700' },
  routineMeta: { fontSize: 13, marginTop: 4 },
  chevron: { fontSize: 11 },
  sessionList: { borderTopWidth: 1, marginTop: 10 },
  sessionRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
  },
  sessionText: { flex: 1, minWidth: 0 },
  sessionName: { fontSize: 16, fontWeight: '600' },
  sessionMuscles: { fontSize: 12, marginTop: 4 },
  setCount: { minWidth: 40, alignItems: 'flex-end', gap: 2, flexShrink: 0 },
  setCountValue: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  setCountLabel: { fontSize: 11 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 },
  actionButton: { borderWidth: 1, minHeight: 44, justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 12 },
  removeButton: { marginRight: 'auto' },
  actionText: { fontSize: 16, fontWeight: '700' },
});
