/**
 * Tarjeta de rutina del acordeón (PRD §8.5).
 *
 * La rutina activa viene expandida y muestra las sesiones del microciclo en
 * curso. Cada sesión indica:
 *  - su FECHA REAL de realización si está completada (`16 SEP`),
 *  - nada (`—`) si está pendiente: el microciclo no está anclado al calendario,
 *    así que inventar un día de la semana sería falso (§3.1),
 *  - `HOY` si es la seleccionada.
 *
 * Cualquier sesión pendiente es pulsable para pasar a ser la sesión activa: el
 * usuario no está obligado a seguir el orden previsto.
 */
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { ROUTINE_ICONS } from '@/components/icons';
import { MesoRail } from './HomeHeader';
import { useTheme } from '@/theme/useTheme';
import { rankedMuscleVolume } from '@/services/training/sessionSummary';
import type { MockRoutine } from '@/mocks/home';

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
    today: string;
    viewMesocycle: string;
    microcycleOf: string;
    activate: string;
    rename: string;
    remove: string;
    active: string;
  };
  onToggle: () => void;
  /** Absent on an inactive routine: its sessions are shown, not started. */
  onSelectSession?: (sessionId: string) => void;
  onPressMesocycle: () => void;
  /** Absent on the active routine. */
  onActivate?: () => void;
  onRename: () => void;
  onRemove: () => void;
}

export function RoutineCard({
  routine,
  expanded,
  selectedSessionId,
  locale,
  muscleLabel,
  labels,
  onToggle,
  onSelectSession,
  onPressMesocycle,
  onActivate,
  onRename,
  onRemove,
}: RoutineCardProps) {
  const { colors, sectionAccent, semantic, radius, spacing } = useTheme();
  const RoutineIcon = ROUTINE_ICONS[routine.icon];
  const current = routine.microcycles[routine.currentMicrocycleIndex];
  const accent = sectionAccent.train;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.bgElevated, borderRadius: radius.lg },
        !expanded && styles.collapsed,
      ]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={routine.name}
        style={styles.header}>
        <View
          style={[styles.iconBadge, { backgroundColor: routine.color, borderRadius: radius.sm }]}>
          <RoutineIcon size={17} color="#16191C" />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.routineName, { color: colors.textPrimary }]}>{routine.name}</Text>
          <Text style={[styles.routineMeta, { color: colors.textMuted }]}>
            {routine.isActive ? `${labels.active} · ` : ''}
            {routine.objective} · {current.sessions.length} {labels.sessions}
          </Text>
        </View>
        <Text style={[styles.chevron, { color: colors.textMuted }]}>{expanded ? '▲' : '▼'}</Text>
      </Pressable>

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
            {current.sessions.map((session) => {
              const isCompleted = session.completedOn !== undefined;
              const isSelected = session.id === selectedSessionId;
              const muscles = rankedMuscleVolume(session.exercises, 3)
                .map((entry) => muscleLabel(entry.muscle))
                .join(' · ');

              return (
                <Pressable
                  key={session.id}
                  onPress={onSelectSession === undefined ? undefined : () => onSelectSession(session.id)}
                  disabled={onSelectSession === undefined}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected, disabled: onSelectSession === undefined }}
                  style={[
                    styles.sessionRow,
                    { borderBottomColor: colors.surfaceBorder },
                    isCompleted && styles.sessionCompleted,
                    isSelected && { backgroundColor: 'rgba(155,227,23,0.08)' },
                  ]}>
                  {/* Fecha real, o nada si está pendiente */}
                  <Text
                    style={[
                      styles.sessionDate,
                      { color: isSelected ? accent : colors.textMuted },
                    ]}>
                    {isSelected
                      ? labels.today
                      : isCompleted
                        ? formatSessionDate(session.completedOn as string, locale)
                        : '—'}
                  </Text>

                  <View style={styles.sessionText}>
                    <Text
                      style={[
                        styles.sessionName,
                        { color: isSelected ? accent : colors.textPrimary },
                      ]}>
                      {session.name}
                    </Text>
                    <Text style={[styles.sessionMuscles, { color: colors.textMuted }]}>
                      {muscles}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.checkbox,
                      {
                        borderColor: isCompleted || isSelected ? accent : colors.surfaceBorder,
                        backgroundColor: isCompleted ? accent : 'transparent',
                      },
                    ]}>
                    {isCompleted ? <Text style={styles.checkMark}>✓</Text> : null}
                  </View>
                </Pressable>
              );
            })}
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
  card: { padding: 12 },
  collapsed: { opacity: 0.72 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBadge: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  routineName: { fontSize: 13.5, fontWeight: '700' },
  routineMeta: { fontSize: 10.5, marginTop: 1 },
  chevron: { fontSize: 10 },
  sessionList: { borderTopWidth: 1, marginTop: 10 },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
  },
  sessionCompleted: { opacity: 0.45 },
  sessionDate: { width: 44, fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  sessionText: { flex: 1 },
  sessionName: { fontSize: 12.5, fontWeight: '600' },
  sessionMuscles: { fontSize: 9.5, marginTop: 1 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { fontSize: 11, fontWeight: '900', color: '#16191C' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  actionButton: { borderWidth: 1, paddingVertical: 7, paddingHorizontal: 12 },
  removeButton: { marginRight: 'auto' },
  actionText: { fontSize: 11.5, fontWeight: '700' },
});
