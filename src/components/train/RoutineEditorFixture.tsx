/** Native interaction fixture. All edits and confirmations remain in component memory. */
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/useTheme';
import { SetType, type WorkoutSession } from '@/models';
import { EXERCISE_CATALOGUE } from '@/services/training/exerciseCatalogue';
import { editWorkoutHistory } from '@/services/training/historyEditing';
import { WorkoutHistoryEditor } from './WorkoutHistoryEditor';
import { RoutineSessionSelector } from './RoutineSessionSelector';
import { PrescriptionEditor } from './PrescriptionEditor';

const exercise = EXERCISE_CATALOGUE[0];
const sample: WorkoutSession = { id: 'editor-fixture', userId: 'fixture', mesocycleId: 'fixture', microcycleId: 'fixture',
  microcycleIndex: 0, plannedSessionIndex: 0, performedAt: 1, completedAt: 1000, sessionName: 'Upper fixture',
  exercises: [{ id: 'entry', exerciseId: exercise.id, order: 0, isSwap: false, exerciseSnapshot: exercise,
    sets: [{ id: 'one', setType: SetType.NORMAL, targetReps: 10, targetRIR: 2, targetWeight: 20, isAutoFilled: false,
      actualWeight: 20, actualReps: 10, actualRIR: 2, completionState: 'DONE' }] }] };
export function RoutineEditorFixture({ onClose }: { onClose: () => void }) {
  const { colors, surfaces } = useTheme(); const { t } = useTranslation(); const insets = useSafeAreaInsets();
  const [cycle, setCycle] = useState(0), [session, setSession] = useState(0), [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false);
  const [record, setRecord] = useState(sample), [saved, setSaved] = useState(false);
  const [planned, setPlanned] = useState({ exerciseId: exercise.id, order: 0, isEdited: false, restSeconds: 120,
    sets: [{ setType: SetType.NORMAL, targetReps: 10, targetRepsMin: 8, targetRIR: 2 }] });
  const confirm = (action: () => void) => dirty ? Alert.alert(t('sharedRoutineEditor.unsaved'), t('sharedRoutineEditor.unsavedHint'), [
    { text: t('generate.cancel'), style: 'cancel' }, { text: t('sharedRoutineEditor.discard'), style: 'destructive', onPress: () => { setDirty(false); action(); } },
  ]) : action();
  return <ScrollView style={{ ...surfaces.screen, flex: 1 }} contentContainerStyle={{ padding: 20, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 30 }}>
    <Pressable accessibilityRole="button" onPress={() => confirm(onClose)} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: colors.accentText }}>Close shared editor fixture</Text></Pressable>
    <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: '700', marginBottom: 20 }}>Shared editor · memory only</Text>
    <RoutineSessionSelector cycle={cycle} cycles={3} sessions={[{ plannedSessionIndex: 0, name: 'Upper fixture' }, { plannedSessionIndex: 1, name: 'Lower fixture' }]}
      selected={session} disabled={busy} onSelect={(next, index) => confirm(() => { setCycle(next); setSession(index); setDirty(false); })} />
    {cycle === 0 && session === 0 ? <WorkoutHistoryEditor key={record.editedAt ?? 0} inline session={record}
      onDirtyChange={setDirty} onBusyChange={setBusy} onClose={() => confirm(onClose)} onSavedClose={() => setDirty(false)}
      onSave={async draft => { setRecord(editWorkoutHistory(record, 'fixture', draft, Date.now())); setSaved(true); }} />
      : <PrescriptionEditor exercise={planned} restSeconds={planned.restSeconds}
        onChangeRest={restSeconds => { setPlanned(old => ({ ...old, restSeconds })); setDirty(true); }}
        onChangeSet={(index, patch) => { setPlanned(old => ({ ...old, sets: old.sets.map((set, position) => position === index ? { ...set, ...patch } : set) })); setDirty(true); }} />}
    {saved && <Text style={{ color: colors.accentText, marginTop: 16 }}>Saved in memory only</Text>}
  </ScrollView>;
}
