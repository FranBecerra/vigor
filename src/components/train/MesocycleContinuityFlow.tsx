import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { useExerciseName } from '@/hooks/useExerciseName';
import type { Exercise } from '@/models';
import type { MicrocycleReview } from '@/models/microcycleReview';
import { previewMesocycleSuccessor, strengthLongitudinalIndicators } from '@/services/training/mesocycleContinuity';
import { orderedRoutineSessions } from '@/services/training/routineRestDays';
import { countWorkingSets } from '@/services/training/sessionSummary';
import type { ContinuityReviewData, ContinuitySelection } from '@/services/training/mesocycleContinuityRepository';
import { StrengthBlockComparison } from './StrengthBlockComparison';

interface Props {
  data: ContinuityReviewData;
  catalogue: ReadonlyMap<string, Exercise>;
  feedback?: readonly MicrocycleReview[] | null;
  onCancel: () => void;
  onReload: () => void;
  onSave: (selection: ContinuitySelection) => Promise<void>;
}

export function MesocycleContinuityFlow({ data, catalogue, feedback, onCancel, onReload, onSave }: Props) {
  const { t } = useTranslation(), name = useExerciseName();
  const { colors, surfaces, radius, spacing, typography, semantic, sectionAccent } = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  const [microcycles, setMicrocycles] = useState(() => Math.min(12, Math.max(1, data.source.projectedMicrocycles ?? 4)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<'stale' | 'save' | null>(null);
  const inFlight = useRef(false);
  const { source, routine, history, priorHistory, now } = data;
  const { review, performance, cycles, nextBlockReview } = useMemo(
    () => strengthLongitudinalIndicators(source, routine.generation.goal, history, priorHistory, catalogue, now, feedback ?? undefined),
    [source, routine.generation.goal, history, priorHistory, catalogue, now, feedback],
  );
  const reason = review.canComplete ? 'COMPLETED' : 'INTERRUPTED';
  const successor = useMemo(() => (review.canComplete || review.canInterrupt)
    ? previewMesocycleSuccessor(routine, source, history, { successorId: 'preview', reason, microcycles, now }).successor
    : null, [review, routine, source, history, reason, microcycles, now]);
  const evidence = new Map<string, typeof performance>();
  for (const signal of performance) evidence.set(signal.exerciseId, [...(evidence.get(signal.exerciseId) ?? []), signal]);
  const exerciseIds = [...new Set(source.plannedSessions?.flatMap(session => session.exercises.map(exercise => exercise.exerciseId)))];
  const submit = async () => {
    if (inFlight.current || !successor || error === 'stale') return;
    inFlight.current = true; setSaving(true); setError(null);
    try { await onSave({ reason, microcycles }); }
    catch (failure) { setError(failure instanceof Error && failure.message === 'staleContinuity' ? 'stale' : 'save'); }
    finally { setSaving(false); inFlight.current = false; }
  };
  const label = (key: string) => t(`continuity.${key}`);
  const card = { ...surfaces.card, padding: spacing.md, borderRadius: radius.lg, gap: spacing.sm };
  const title = { ...typography.h1, color: colors.textPrimary };
  const heading = { ...typography.body, color: colors.textPrimary, fontWeight: '700' as const };
  const secondary = { ...typography.body, color: colors.textSecondary };
  const row = { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: spacing.sm };
  const action = step === 1 ? 'prepare' : error === 'stale' ? 'refresh' : error === 'save' ? 'retry' : 'activate';

  return <View style={{ ...surfaces.screen, flex: 1, paddingTop: insets.top }}>
    <View style={{ ...row, paddingHorizontal: spacing.lg }}>
      <Pressable accessibilityRole="button" disabled={saving} onPress={step === 1 ? onCancel : () => setStep(1)} style={{ justifyContent: 'center', minHeight: 44 }}>
        <Text style={secondary}>‹ {label('back')}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" disabled={saving} onPress={onCancel} style={{ justifyContent: 'center', minHeight: 44 }}>
        <Text style={{ ...secondary, color: colors.accentText }}>{label('cancel')}</Text>
      </Pressable>
    </View>
    <View style={{ ...row, paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
      {[label('balance'), label('nextBlock')].map((stage, index) => <View key={stage} style={{ flex: 1, gap: 8 }}>
        <Text style={{ ...typography.caption, color: step === index + 1 ? colors.accentText : colors.textSecondary }}>{index + 1} · {stage}</Text>
        <View style={{ height: 2, borderRadius: 1, backgroundColor: step === index + 1 ? sectionAccent.train : colors.surfaceBorder }} />
      </View>)}
    </View>
    <ScrollView key={step} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md }}>
      <View>
        <Text accessibilityRole="header" style={title}>{label(step === 1 ? 'title' : 'nextBlock')}</Text>
        <Text style={secondary}>{routine.name} · {t('continuity.cycles', { count: step === 1 ? new Set(review.occurrences.map(item => item.cycleIndex)).size : microcycles })}</Text>
      </View>
      {step === 1 ? <>
        <View style={card}>
          <Text accessibilityRole="header" style={heading}>{label('planAndActual')}</Text>
          <View style={{ ...row, alignItems: 'flex-start' }}>
            {[[`${review.completed}/${review.occurrences.length}`, 'done'], [String(review.skipped), 'skipped'],
              [`${review.actualWorkingSets}/${review.plannedWorkingSets}`, 'workingSets']].map(([value, key]) => <View key={key} style={{ flex: 1 }}>
              <Text style={{ ...typography.h2, color: colors.accentText, fontVariant: ['tabular-nums'] }}>{value}</Text>
              <Text style={{ ...typography.caption, color: colors.textSecondary }}>{label(key)}</Text>
            </View>)}
          </View>
          {review.blocked && <Text accessibilityRole="alert" style={secondary}>{label('blocked')}</Text>}
          {!review.blocked && reason === 'INTERRUPTED' && <Text style={secondary}>{label('interrupted')}</Text>}
        </View>
        <StrengthBlockComparison cycles={cycles} assessment={nextBlockReview} />
        <View style={card}>
          <Text accessibilityRole="header" style={heading}>{label('observed')}</Text>
          {exerciseIds.map(id => {
            const directions = [...new Set(evidence.get(id)?.filter(item => item.direction !== 'INSUFFICIENT').map(item => item.direction))];
            const direction = directions.length === 0 ? 'INSUFFICIENT' : directions.length === 1 ? directions[0] : 'MIXED';
            const exercise = catalogue.get(id) ?? source.plannedSessions?.flatMap(session => session.exercises).find(item => item.exerciseId === id)?.exerciseSnapshot;
            return <View key={id} style={row}>
              <Text style={{ ...heading, flex: 1 }}>{(exercise ? name(exercise) : id)}</Text>
              <Text style={{ ...typography.caption, color: direction === 'HIGHER' ? colors.accentText : colors.textSecondary, flexShrink: 1 }}>{label(direction)}</Text>
            </View>;
          })}
        </View>
        <View style={card}>
          <Text accessibilityRole="header" style={heading}>{label('kept')}</Text>
          <Text style={secondary}>{label('keptDetail')}</Text>
        </View>
      </> : successor && <>
        <View style={card}>
          <View style={row}>
            <Text style={heading}>{label('duration')}</Text>
            <View style={row}>
              <Pressable accessibilityRole="button" accessibilityLabel={label('fewer')} disabled={saving || microcycles === 1}
                onPress={() => setMicrocycles(value => Math.max(1, value - 1))} style={{ ...surfaces.field, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', opacity: microcycles === 1 ? 0.45 : 1, borderRadius: radius.sm }}>
                <Text style={heading}>−</Text>
              </Pressable>
              <Text style={heading}>{microcycles}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={label('more')} disabled={saving || microcycles === 12}
                onPress={() => setMicrocycles(value => Math.min(12, value + 1))} style={{ ...surfaces.field, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', opacity: microcycles === 12 ? 0.45 : 1, borderRadius: radius.sm }}>
                <Text style={heading}>+</Text>
              </Pressable>
            </View>
          </View>
          <Text style={secondary}>{label(successor.prescriptionMode === 'MANUAL' ? 'fixedDose'
            : microcycles > 1 ? 'automaticProgression' : 'automaticSingleCycle')}</Text>
        </View>
        <View style={card}>
          <Text accessibilityRole="header" style={heading}>{label('sessions')}</Text>
          {orderedRoutineSessions(successor.plannedSessions ?? [], successor.sessionOrder).map(session => <View key={session.index} style={row}>
            <Text style={{ ...heading, flex: 1 }}>{session.name || t(`generate.focus${session.focus}`)}</Text>
            <Text style={secondary}>{t('continuity.setCount', { count: session.exercises.reduce((sum, exercise) => sum + countWorkingSets(exercise.sets), 0) })}</Text>
          </View>)}
        </View>
      </>}
    </ScrollView>
    <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: insets.bottom + spacing.sm, gap: spacing.sm }}>
      {error && <Text accessibilityRole="alert" style={{ ...secondary, color: semantic.danger }}>{label(error === 'stale' ? 'changed' : 'saveError')}</Text>}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: saving || !successor, busy: saving }} disabled={saving || !successor}
        onPress={step === 1 ? () => setStep(2) : error === 'stale' ? onReload : submit}
        style={{ ...surfaces.primary, opacity: successor ? 1 : 0.45, borderRadius: radius.lg, minHeight: 52, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.md }}>
        {saving ? <ActivityIndicator color={colors.onAccent} /> : <Text style={{ ...heading, color: colors.onAccent, textAlign: 'center' }}>{label(action)}</Text>}
      </Pressable>
      <Text style={{ ...typography.caption, color: colors.textSecondary, textAlign: 'center' }}>{label(step === 1 ? 'confirmLater' : 'confirmDetail')}</Text>
    </View>
  </View>;
}
