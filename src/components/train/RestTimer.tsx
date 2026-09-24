/**
 * Temporizador de descanso con controles (PRD §3.4, §8.5).
 *
 * Al pulsar el temporizador se despliegan los controles: **−10 s**, **+10 s**,
 * **reiniciar**, **editar** (duración absoluta) y **descartar**.
 *
 * El componente solo PINTA: toda la aritmética vive en
 * `src/services/training/restTimer.ts` (lógica pura, 100 % cubierta). Aquí solo
 * hay un tick de un segundo para repintar, y el tiempo restante se deriva del
 * reloj — no se va acumulando error.
 */
import { useEffect, useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { GlassSurface } from '@/components/GlassSurface';
import { useTheme } from '@/theme/useTheme';
import {
  REST_STEP_SECONDS,
  formatRest,
  isRestFinished,
  remainingSeconds,
  type RestTimerState,
} from '@/services/training/restTimer';

interface RestTimerProps {
  state: RestTimerState;
  onAdjust: (deltaSeconds: number) => void;
  onRestart: () => void;
  onSetDuration: (seconds: number) => void;
  onCancel: () => void;
}

export function RestTimer({
  state,
  onAdjust,
  onRestart,
  onSetDuration,
  onCancel,
}: RestTimerProps) {
  const { colors, sectionAccent, semantic, radius, spacing } = useTheme();
  const [now, setNow] = useState(() => Date.now());
  const [controlsOpen, setControlsOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');

  const isActive = state.startedAt !== null;

  // Tick de 1 s solo mientras hay un descanso activo: sin temporizador no se
  // programa nada, para no repintar en balde.
  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isActive]);

  // Al desaparecer el descanso, recoge los controles.
  useEffect(() => {
    if (!isActive) {
      setControlsOpen(false);
      setEditing(false);
    }
  }, [isActive]);

  const remaining = remainingSeconds(state, now);
  const finished = isRestFinished(state, now);
  // Verde mientras corre, ámbar cuando se agota: el color semántico manda.
  const tint = !isActive ? colors.textMuted : finished ? semantic.warning : sectionAccent.train;

  function commitEdit() {
    const minutesAndSeconds = editText.trim();
    if (minutesAndSeconds !== '') {
      // Admite "90" (segundos) y "2:30" (minutos:segundos).
      const parts = minutesAndSeconds.split(':');
      const seconds =
        parts.length === 2
          ? Number(parts[0]) * 60 + Number(parts[1])
          : Number(minutesAndSeconds);
      if (Number.isFinite(seconds)) onSetDuration(seconds);
    }
    setEditing(false);
    setEditText('');
  }

  return (
    <View style={styles.container}>
      {controlsOpen && isActive ? (
        <Animated.View
          entering={FadeIn.duration(120)}
          exiting={FadeOut.duration(100)}
          style={[
            styles.controls,
            {
              backgroundColor: colors.bgElevated,
              borderColor: colors.surfaceBorder,
              borderRadius: radius.lg,
              gap: spacing.xs,
            },
          ]}>
          {editing ? (
            <View style={styles.editRow}>
              <TextInput
                value={editText}
                onChangeText={setEditText}
                onSubmitEditing={commitEdit}
                onBlur={commitEdit}
                placeholder="2:30"
                placeholderTextColor={colors.textMuted}
                keyboardType="numbers-and-punctuation"
                autoFocus
                accessibilityLabel="Duración del descanso"
                style={[
                  styles.editInput,
                  {
                    color: colors.textPrimary,
                    borderColor: colors.surfaceBorder,
                    borderRadius: radius.sm,
                  },
                ]}
              />
              <ControlButton label="OK" onPress={commitEdit} tint={sectionAccent.train} />
            </View>
          ) : (
            <View style={styles.controlRow}>
              <ControlButton label={`−${REST_STEP_SECONDS}`} onPress={() => onAdjust(-REST_STEP_SECONDS)} />
              <ControlButton label={`+${REST_STEP_SECONDS}`} onPress={() => onAdjust(REST_STEP_SECONDS)} />
              <ControlButton label="↺" onPress={onRestart} accessibilityLabel="Reiniciar descanso" />
              <ControlButton
                label="✎"
                onPress={() => {
                  setEditText(formatRest(state.durationSeconds));
                  setEditing(true);
                }}
                accessibilityLabel="Editar duración"
              />
              <ControlButton
                label="✕"
                onPress={onCancel}
                tint={semantic.danger}
                accessibilityLabel="Descartar descanso"
              />
            </View>
          )}
        </Animated.View>
      ) : null}

      <Pressable
        onPress={() => isActive && setControlsOpen((open) => !open)}
        accessibilityRole="button"
        accessibilityLabel={
          isActive ? `Descanso ${formatRest(remaining)}. Pulsa para ajustar.` : 'Sin descanso'
        }>
        <GlassSurface
          glassEffectStyle="regular"
          style={[styles.timer, { borderRadius: radius.md }]}>
          <Text style={[styles.timerText, { color: tint }]}>
            {isActive ? formatRest(remaining) : '—:—'}
          </Text>
        </GlassSurface>
      </Pressable>
    </View>
  );
}

interface ControlButtonProps {
  label: string;
  onPress: () => void;
  tint?: string;
  accessibilityLabel?: string;
}

function ControlButton({ label, onPress, tint, accessibilityLabel }: ControlButtonProps) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={[styles.controlButton, { backgroundColor: colors.surface, borderRadius: radius.sm }]}>
      <Text style={[styles.controlLabel, { color: tint ?? colors.textPrimary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'flex-end' },
  timer: { paddingHorizontal: 12, paddingVertical: 6, overflow: 'hidden' },
  timerText: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  controls: {
    position: 'absolute',
    top: 34,
    right: 0,
    borderWidth: 1,
    padding: 8,
    zIndex: 30,
  },
  controlRow: { flexDirection: 'row', gap: 6 },
  editRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  controlButton: {
    minWidth: 38,
    height: 32,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlLabel: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  editInput: {
    width: 72,
    height: 32,
    borderWidth: 1,
    paddingHorizontal: 8,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
