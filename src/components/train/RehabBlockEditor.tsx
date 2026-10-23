import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { useExerciseCatalogue } from '@/hooks/useExerciseCatalogue';
import { useRehabilitation } from '@/hooks/useRehabilitation';
import { useTheme } from '@/theme/useTheme';
import { recordingOf } from '@/services/training/customExercises';
import type { Exercise, RehabBlock, RehabPrescription } from '@/models';
import { ExerciseSwapSheet } from './generate/ExerciseSwapSheet';
import { NumericField } from './NumericField';
import { useRoutines } from '@/hooks/useRoutines';

export function RehabBlockEditor({ initial, onClose }: { initial?: RehabBlock; onClose: () => void }) {
  const { t } = useTranslation();
  const { uid } = useAuth();
  const { catalogue } = useExerciseCatalogue();
  const { saveBlock } = useRehabilitation();
  const { routines } = useRoutines();
  const activeRoutine = routines.find((routine) => routine.isActive);
  const { colors, sectionAccent, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(initial?.name ?? '');
  const [items, setItems] = useState<RehabPrescription[]>(initial?.items ?? []);
  const [scheduleKind, setScheduleKind] = useState<'WEEKLY' | 'DAYS' | 'ROUTINE'>(initial?.schedule.kind ?? 'WEEKLY');
  const [routineSessions, setRoutineSessions] = useState<number[]>(initial?.schedule.kind === 'ROUTINE' ? initial.schedule.sessionIndexes : []);
  const [target, setTarget] = useState<number | undefined>(initial?.schedule.kind === 'WEEKLY' ? initial.schedule.target : undefined);
  const [days, setDays] = useState<number[]>(initial?.schedule.kind === 'DAYS' ? initial.schedule.days : []);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const patch = (id: string, update: Partial<RehabPrescription>) => setItems((old) => old.map((item) => item.id === id ? { ...item, ...update } : item));
  const add = (exercise: Exercise) => {
    setItems((old) => [...old, { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, exerciseId: exercise.id,
      exerciseSnapshot: exercise, sets: 0, min: 0, max: 0, restSeconds: 0, notes: '' }]);
    setPicker(false);
  };
  const text = { color: colors.textPrimary };
  const button = { backgroundColor: colors.bgElevated, padding: spacing.md, borderRadius: radius.md, marginVertical: 6 };
  return <Modal visible animationType="slide" onRequestClose={() => { if (!busy) { if (picker) setPicker(false); else onClose(); } }}>
    {picker ? <ExerciseSwapSheet embedded open mode="add" current={null}
      candidates={catalogue.filter((exercise) => exercise.archivedAt === undefined)} onSelect={add} onClose={() => setPicker(false)} /> :
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, backgroundColor: colors.bg,
      padding: spacing.lg, paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + 40 }}>
      <Text style={{ ...text, fontSize: 24, fontWeight: '700' }}>{t('rehab.editBlock')}</Text>
      <TextInput style={{ ...button, ...text }} value={name} onChangeText={setName} maxLength={120}
        placeholder={t('rehab.name')} placeholderTextColor={colors.textMuted} accessibilityLabel={t('rehab.name')} />
      <Text style={{ color: colors.textMuted }}>{t('rehab.userPrescription')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {(['WEEKLY', 'DAYS', 'ROUTINE'] as const).map((kind) => <Pressable key={kind} style={{ ...button,
          borderWidth: 1, borderColor: scheduleKind === kind ? sectionAccent.train : colors.surfaceBorder }} onPress={() => setScheduleKind(kind)}>
          <Text style={text}>{t(`rehab.${kind}`)}</Text>
        </Pressable>)}
      </View>
      {scheduleKind === 'WEEKLY' ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text style={{ ...text, flex: 1, flexShrink: 1 }}>{t('rehab.timesPerWeek')}</Text><View style={{ width: 64 }}><NumericField value={target} onChangeValue={setTarget} accessibilityLabel={t('rehab.timesPerWeek')} /></View>
      </View> : scheduleKind === 'ROUTINE' ? <View>
        <Text style={text}>{activeRoutine?.name ?? t('workout.noActiveRoutine')}</Text>
        {activeRoutine?.microcycles[activeRoutine.currentMicrocycleIndex]?.sessions.map((session) => <Pressable key={session.id} style={{ ...button, flexDirection: 'row', alignItems: 'center', gap: 12 }}
          accessibilityRole="checkbox" accessibilityState={{ checked: routineSessions.includes(session.plannedSessionIndex) }}
          onPress={() => setRoutineSessions((old) => old.includes(session.plannedSessionIndex) ? old.filter((index) => index !== session.plannedSessionIndex) : [...old, session.plannedSessionIndex])}>
          <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: routineSessions.includes(session.plannedSessionIndex) ? sectionAccent.train : colors.textMuted,
            backgroundColor: routineSessions.includes(session.plannedSessionIndex) ? sectionAccent.train : 'transparent', justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: colors.onAccent }}>{routineSessions.includes(session.plannedSessionIndex) ? '✓' : ''}</Text>
          </View>
          <Text style={{ color: colors.textPrimary, flex: 1 }}>{session.name}</Text>
        </Pressable>)}
      </View> : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {[1, 2, 3, 4, 5, 6, 7].map((day) => <Pressable key={day} onPress={() => setDays((old) => old.includes(day) ? old.filter((value) => value !== day) : [...old, day])}
          accessibilityRole="checkbox" accessibilityState={{ checked: days.includes(day) }} style={button}>
          <Text style={{ color: days.includes(day) ? colors.accentText : colors.textPrimary }}>{t(`rehab.day${day}`)}</Text>
        </Pressable>)}
      </View>}
      {items.map((item, position) => {
        const mode = recordingOf(item.exerciseSnapshot);
        return <View key={item.id} style={{ ...button, padding: spacing.lg }}>
          <Text style={{ ...text, fontSize: 17, fontWeight: '600' }}>{item.exerciseSnapshot.name}</Text>
          {item.exerciseSnapshot.notes && <Text style={{ color: colors.textMuted }}>{item.exerciseSnapshot.notes}</Text>}
          {mode.measure === 'SECONDS' && <Text style={text}>{t('rehab.secondsPerSet')}</Text>}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginVertical: 12 }}>
            {([['sets', item.sets, t('train.sets')], ['min', item.min, t(mode.measure === 'SECONDS' ? 'rehab.secondsMin' : 'generate.previewRepMin')],
              ['max', item.max, t(mode.measure === 'SECONDS' ? 'rehab.secondsMax' : 'generate.previewRepMax')], ['restSeconds', item.restSeconds, t('rehab.rest')]] as const)
              .map(([key, value, label]) => <View key={key} style={{ width: key === 'restSeconds' ? 104 : 72 }}><Text style={text}>{label}</Text>
                <NumericField value={value || undefined} onChangeValue={(next) => patch(item.id, { [key]: next ?? 0 })} accessibilityLabel={label} />
              </View>)}
            {mode.load !== 'NONE' && <View style={{ width: 104 }}><Text style={text}>{t(`custom.${mode.load}`)}</Text>
              <NumericField value={item.load} decimal onChangeValue={(value) => patch(item.id, { load: value })} accessibilityLabel={t(`custom.${mode.load}`)} />
            </View>}
          </View>
          <TextInput value={item.notes} onChangeText={(notes) => patch(item.id, { notes })} multiline maxLength={2000}
            placeholder={t('custom.notes')} placeholderTextColor={colors.textMuted} style={{ ...text, minHeight: 40 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Pressable disabled={position === 0} onPress={() => setItems((old) => {
              const next = [...old]; [next[position - 1], next[position]] = [next[position], next[position - 1]]; return next;
            })}><Text style={text}>{t('rehab.moveUp')}</Text></Pressable>
            <Pressable onPress={() => setItems((old) => old.filter((entry) => entry.id !== item.id))}><Text style={text}>{t('generate.removeExercise')}</Text></Pressable>
          </View>
        </View>;
      })}
      <Pressable style={button} onPress={() => setPicker(true)}><Text style={{ color: colors.accentText }}>{t('generate.addExercise')}</Text></Pressable>
      <Text style={{ color: colors.textMuted }}>{t('rehab.inlineHint')}</Text>
      {!!error && <Text accessibilityRole="alert" style={text}>{t(`rehab.${error}`, { defaultValue: t('rehab.saveFailed') })}</Text>}
      <Pressable disabled={busy} style={{ ...button, backgroundColor: sectionAccent.train }} onPress={async () => {
        if (!uid) return;
        setBusy(true); setError('');
        const now = Date.now();
        try {
          await saveBlock({ id: initial?.id ?? `rehab-${now}-${Math.random().toString(36).slice(2)}`, userId: uid,
            version: 1, name: name.trim(), items, schedule: scheduleKind === 'WEEKLY'
              ? { kind: 'WEEKLY', target: target ?? 0 } : scheduleKind === 'DAYS' ? { kind: 'DAYS', days: [...days].sort() }
                : { kind: 'ROUTINE', routineId: activeRoutine?.id ?? '', sessionIndexes: routineSessions },
            active: initial?.active ?? true, createdAt: initial?.createdAt ?? now, updatedAt: now,
            ...(initial?.injuryId ? { injuryId: initial.injuryId } : {}) });
          onClose();
        } catch (cause) { setError(cause instanceof Error ? cause.message : 'saveFailed'); }
        finally { setBusy(false); }
      }}><Text style={{ color: colors.onAccent, textAlign: 'center', fontWeight: '700' }}>{t(busy ? 'custom.saving' : 'custom.save')}</Text></Pressable>
      <Pressable disabled={busy} onPress={onClose} style={button}><Text style={{ ...text, textAlign: 'center' }}>{t('generate.cancel')}</Text></Pressable>
    </ScrollView>}
  </Modal>;
}
