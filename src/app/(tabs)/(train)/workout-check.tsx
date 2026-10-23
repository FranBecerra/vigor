/** Internal, in-memory workout acceptance fixture. Never reads or writes athlete data. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { WorkoutPagerGestureContext } from '@/components/train/WorkoutPagerGesture';
import { PrescriptionEditor } from '@/components/train/PrescriptionEditor';
import { RIRProgressionPreview } from '@/components/train/RIRProgressionPreview';
import { replanSessionRIR } from '@/services/training/rirReplanning';
import { prescriptionForMicrocycle } from '@/services/training/microcyclePrescription';
import { AppState, Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme/useTheme';
import { SetType, type WorkoutSession, type PlannedExercise, type PlannedSession } from '@/models';
import { EXERCISE_CATALOGUE } from '@/services/training/exerciseCatalogue';
import { nextExerciseAfterCompletion, replacementWorkoutSets, updateWorkoutSet } from '@/services/training/workoutExecution';
import { sessionProgress, toSessionSetsByExercise, toWorkoutSession, type SessionSetsByExercise } from '@/services/training/sessionMapper';
import { workoutReview } from '@/services/training/workoutReview';
import { ExercisePage } from '@/components/train/ExercisePage';
import { WorkoutExerciseStrip } from '@/components/train/WorkoutExerciseStrip';
import { RestTimer } from '@/components/train/RestTimer';
import { adjustRest, IDLE_REST_TIMER, restartRest, setRestDuration, startRest } from '@/services/training/restTimer';
import { useWorkoutActivity } from '@/hooks/useWorkoutActivity';
import { WorkoutNotesSheet } from '@/components/train/WorkoutNotesSheet';
import { WorkoutHistoryCard } from '@/components/train/WorkoutHistoryCard';
import { WorkoutHistoryDetails } from '@/components/train/WorkoutHistoryDetails';
import { workoutHistoryDetails } from '@/services/training/workoutHistory';
import { visibleWorkoutNotes } from '@/services/training/trainingNotes';
import { nativeRestFeedbackStatus } from '@/services/training/nativeRestFeedback';
import { WorkoutHistoryEditor } from '@/components/train/WorkoutHistoryEditor';
import { editWorkoutHistory } from '@/services/training/historyEditing';
import { RoutineDayFixture } from '@/components/train/RoutineDayFixture';
import { ExerciseSwapSheet } from '@/components/train/generate/ExerciseSwapSheet';

const INITIAL = EXERCISE_CATALOGUE.slice(0, 7);
const INITIAL_PRESCRIPTION: PlannedExercise = { exerciseId: INITIAL[0].id, order: 0, isEdited: false,
  sets: Array.from({ length: 3 }, () => ({ setType: SetType.NORMAL, targetRepsMin: 8, targetReps: 12, targetRIR: 2 })), restSeconds: 150 };
const PRESCRIPTION_SESSION: PlannedSession = { index: 0, focus: 'UPPER', exercises: [INITIAL_PRESCRIPTION], estimatedWorkMinutes: 10 };
const context = { sessionId: 'fixture', userId: 'fixture', mesocycleId: 'fixture', microcycleId: 'fixture', microcycleIndex: 0, performedAt: 1 };
const makeSets = () => Object.fromEntries(INITIAL.map((exercise) => [exercise.id, Array.from({ length: 3 }, (_, index) => ({
  id: `${exercise.id}:${index}`, setType: index === 0 ? SetType.WARMUP : SetType.NORMAL,
  targetWeight: 20, targetReps: 10, targetRIR: 2, isAutoFilled: false, isCompleted: false,
}))]));
const baseline = toWorkoutSession({ ...context, sessionId: 'fixture-baseline', completedAt: 2 }, INITIAL.map((exercise) => exercise.id),
  Object.fromEntries(Object.entries(makeSets()).map(([id, rows]) => [id, rows.map((row) => ({ ...row, isCompleted: true, actualWeight: 20, actualReps: 8 }))])));

export default function WorkoutCheckScreen() {
  const { colors, typography, sectionAccent } = useTheme(); const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions(); const router = useRouter();
  const [exercises, setExercises] = useState(INITIAL); const [sets, setSets] = useState<SessionSetsByExercise>(makeSets);
  const [page, setPage] = useState(0); const [timer, setTimer] = useState(IDLE_REST_TIMER);
  const [fixtureRest, setFixtureRest] = useState(150);
  const [timelineOpen, setTimelineOpen] = useState(false), [pickerOpen, setPickerOpen] = useState(false);
  const [prescriptionOpen, setPrescriptionOpen] = useState(false);
  const [progressionOpen, setProgressionOpen] = useState(false);
  const [prescription, setPrescription] = useState<PlannedExercise>(INITIAL_PRESCRIPTION);
  const pagerGesture = useMemo(() => Gesture.Native(), []);
  const [activityEnabled, setActivityEnabled] = useState(false); const [activityEnded, setActivityEnded] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false); const [historyOpen, setHistoryOpen] = useState(false); const [historyDetail, setHistoryDetail] = useState(false);
  const [notes, setNotes] = useState({ SESSION: '', EXERCISE: '', MESOCYCLE: '' });
  const [historyEditing, setHistoryEditing] = useState(false); const [editedSample, setEditedSample] = useState<WorkoutSession | null>(null);
  const [feedbackStatus, setFeedbackStatus] = useState('Not sampled');
  useEffect(() => {
    let alive = true;
    const read = () => void nativeRestFeedbackStatus().then((status) => {
      if (alive) setFeedbackStatus(JSON.stringify({ js: AppState.currentState, ...status }));
    }).catch(() => { if (alive) setFeedbackStatus('Native diagnostics unavailable'); });
    read(); const polling = setInterval(read, 500);
    return () => { alive = false; clearInterval(polling); };
  }, []);
  const pager = useRef<ScrollView>(null); const progress = sessionProgress(sets);
  const review = workoutReview(exercises, sets, [baseline], 'fixture');
  useWorkoutActivity(activityEnabled ? { ...context, sessionName: 'WORKOUT CHECK', trainingGoal: 'HYPERTROPHY', plannedSessionIndex: 0,
    activeExerciseId: exercises[page]?.id, restTimer: timer } : null, exercises, sets, activityEnded);
  const go = (index: number) => { setPage(index); pager.current?.scrollTo({ x: index * width, animated: true }); };
  const button = (label: string, onPress: () => void) => <Pressable accessibilityRole="button" onPress={onPress} style={{ padding: 10 }}>
    <Text style={{ color: colors.accentText }}>{label}</Text></Pressable>;
  return <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
    <Text style={[typography.emphasis, { color: colors.textPrimary, paddingHorizontal: 20 }]}>WORKOUT CHECK</Text>
    <Text style={{ color: colors.textSecondary, paddingHorizontal: 20 }}>Fixture only · no account writes · {progress.completed}/{progress.total} work sets</Text>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10 }}>
      {button('Resume snapshot', () => setSets(toSessionSetsByExercise(toWorkoutSession(context, exercises.map((ex) => ex.id), sets))))}
      {button('Test 3s alarm', () => setTimer(startRest('fixture', 3, Date.now())))}
      <RestTimer state={timer} prescribedSeconds={fixtureRest} exerciseName="Fixture exercise · no account writes" onSetPrescription={async (seconds) => setFixtureRest(seconds)}
        onAdjust={(delta) => setTimer((old) => adjustRest(old, delta))} onRestart={() => setTimer((old) => restartRest(old, Date.now()))} onCancel={() => setTimer(IDLE_REST_TIMER)} onSetDuration={(seconds) => setTimer((old) => setRestDuration(old, seconds))} />
    </View>
    <WorkoutExerciseStrip exercises={exercises} activeId={exercises[page]?.id} onSelect={go} onAdd={() => {}} onReorder={(next) => {
      const id = exercises[page]?.id; setExercises(next); go(Math.max(0, next.findIndex((ex) => ex.id === id)));
    }} />
    <WorkoutPagerGestureContext.Provider value={pagerGesture}><GestureDetector gesture={pagerGesture}><ScrollView horizontal pagingEnabled ref={pager} onMomentumScrollEnd={(event) => setPage(Math.round(event.nativeEvent.contentOffset.x / width))}>
      {exercises.map((exercise, exerciseIndex) => <ExercisePage key={exercise.id} active={exerciseIndex === page} exercise={exercise} sets={sets[exercise.id] ?? []} recordSetIds={review.recordSetIds} scale="RIR" width={width} bottomInset={0}
        scopedNotes={visibleWorkoutNotes(notes.SESSION, notes.EXERCISE, notes.MESOCYCLE)} onAction={(_id, action) => { if (action === 'note') setNotesOpen(true); }}
        onPressSetType={() => {}} onAddSet={() => {}} onRemoveSet={(id, setId) => setSets((old) => ({ ...old, [id]: old[id].filter((row) => row.id !== setId) }))}
        onUpdateSet={(id, setId, patch) => {
          const next = { ...sets, [id]: sets[id].map((row) => row.id === setId ? updateWorkoutSet(row, patch) : row) };
          setSets(next);
          if (patch.isCompleted) { const following = nextExerciseAfterCompletion(exercises.map((ex) => ex.id), next, id); if (following !== null) go(following); }
        }} />)}
    </ScrollView></GestureDetector></WorkoutPagerGestureContext.Provider>
    <Text selectable style={{ color: colors.textSecondary, fontSize: 11, paddingHorizontal: 12 }}>{feedbackStatus}</Text>
    <Text style={{ color: colors.textPrimary, padding: 12 }}>Review: {review.completed} work sets · {review.pending} pending · {review.tonnage} kg × reps</Text>
    {button('Test fresh custom swap (fixture)', () => {
      const original = exercises[page]; if (!original || original.isCustom) return;
      const custom = { ...original, id: 'custom:fixture:bulgarian', name: 'Custom Bulgarian split squat', isCustom: true,
        ownerId: 'fixture', recording: { measure: 'REPETITIONS' as const, load: 'TOTAL_KG' as const } };
      const rows = replacementWorkoutSets(sets[original.id] ?? [], makeSets()[INITIAL[0].id].map((row) => ({ ...row, setType: SetType.NORMAL, targetWeight: 0, recording: custom.recording })), 'custom-fixture');
      const completed = (sets[original.id] ?? []).filter((row) => row.isCompleted);
      setExercises((old) => old.flatMap((entry) => entry.id !== original.id ? [entry] : completed.length ? [entry, custom] : [custom]));
      const next = { ...sets, [custom.id]: rows }; if (completed.length) next[original.id] = completed; else delete next[original.id]; setSets(next);
      if (completed.length) go(page + 1);
    })}
    {button('Preview history (fixture)', () => { setHistoryDetail(false); setHistoryOpen(true); })}
    {button('Timeline and picker (fixture)', () => setTimelineOpen(true))}
    {button('Prescription editor (fixture)', () => setPrescriptionOpen(true))}
    {!activityEnabled && button('Test lock-screen activity', () => setActivityEnabled(true))}
    {button(activityEnabled && !activityEnded ? 'End test activity' : 'Back (discard fixture)', () => {
      if (activityEnabled && !activityEnded) setActivityEnded(true); else router.replace('/(tabs)/(train)');
    })}
    {notesOpen && <WorkoutNotesSheet open exerciseName={exercises[page]?.name ?? 'Fixture'} values={notes}
      onSave={async (scope, text) => setNotes((old) => ({ ...old, [scope]: text }))} onClose={() => setNotesOpen(false)} />}
    <Modal visible={prescriptionOpen} onRequestClose={() => setPrescriptionOpen(false)}>
      <View style={{ flex: 1, padding: 20, paddingTop: insets.top + 20, backgroundColor: colors.bg }}>
        <Text style={[typography.title, { color: colors.textPrimary }]}>Prescription fixture · no account writes</Text>
        <PrescriptionEditor exercise={prescription} restSeconds={prescription.restSeconds ?? 150}
          onChangeRest={(seconds) => setPrescription((previous) => ({ ...previous, restSeconds: seconds }))}
          onChangeSet={(index, patch) => setPrescription((previous) => ({ ...previous, sets: previous.sets.map((set, position) => position === index ? { ...set, ...patch } : set) }))} />
        {button('Close prescription fixture', () => setPrescriptionOpen(false))}
        {button('Preview RIR progression (fixture)', () => setProgressionOpen(true))}
        <RIRProgressionPreview steps={progressionOpen ? replanSessionRIR(Array.from({ length: 6 }, (_, index) => ({ index,
          session: prescriptionForMicrocycle([PRESCRIPTION_SESSION], 'HYPERTROPHY', index, 6)[0] })), { ...PRESCRIPTION_SESSION, exercises: [prescription] }, 0, 6) : null}
          catalogue={new Map(INITIAL.map((exercise) => [exercise.id, exercise]))} busy={false} onApply={() => setProgressionOpen(false)} onClose={() => setProgressionOpen(false)} />
      </View>
    </Modal>
    <Modal visible={timelineOpen} onRequestClose={() => setTimelineOpen(false)}>
      <View style={{ flex: 1, padding: 20, paddingTop: insets.top + 20, backgroundColor: colors.bg }}>
        <Text style={[typography.title, { color: colors.textPrimary, marginBottom: 20 }]}>Timeline fixture · no account writes</Text>
        <RoutineDayFixture />
        {button('Open fixture picker', () => setPickerOpen(true))}
        {button('Close timeline fixture', () => setTimelineOpen(false))}
        <ExerciseSwapSheet open={pickerOpen} current={INITIAL[0]} candidates={EXERCISE_CATALOGUE}
          onSelect={() => setPickerOpen(false)} onClose={() => setPickerOpen(false)} />
      </View>
    </Modal>
    <Modal visible={historyOpen} onRequestClose={() => setHistoryOpen(false)}>
      <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 20, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }}>
        <Text style={[typography.title, { color: colors.textPrimary }]}>History fixture · no account writes</Text>
        {(() => {
          const exercise = exercises[0]; const sample = editedSample ?? toWorkoutSession({ ...context, sessionName: 'Upper fixture', sessionNote: notes.SESSION,
            mesocycleNote: notes.MESOCYCLE, performedAt: Date.now() - 600000, completedAt: Date.now(),
            persistentExerciseNotes: { [exercise.id]: notes.EXERCISE }, exerciseSnapshots: { [exercise.id]: exercise } }, [exercise.id],
          { [exercise.id]: makeSets()[INITIAL[0].id].map((row) => ({ ...row, isCompleted: true, actualWeight: 35, actualReps: 8, actualRIR: 2 })) });
          return historyDetail ? <><WorkoutHistoryDetails details={workoutHistoryDetails(sample, new Map())} recordSetIds={workoutReview([exercise], toSessionSetsByExercise(sample), [baseline], sample.id).recordSetIds} />
            {button('Edit history fixture', () => setHistoryEditing(true))}
            {historyEditing && <WorkoutHistoryEditor session={sample} onClose={() => setHistoryEditing(false)} onSave={async (draft) => { setEditedSample(editWorkoutHistory(sample, 'fixture', draft, Date.now())); }} />}</>
            : <WorkoutHistoryCard session={sample} catalogue={new Map()} onPress={() => setHistoryDetail(true)} />;
        })()}
        {button('Close history fixture', () => setHistoryOpen(false))}
      </ScrollView>
    </Modal>
  </View>;
}
