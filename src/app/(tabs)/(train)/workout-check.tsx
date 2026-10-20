/** Internal, in-memory workout acceptance fixture. Never reads or writes athlete data. */
import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme/useTheme';
import { SetType } from '@/models';
import { EXERCISE_CATALOGUE } from '@/services/training/exerciseCatalogue';
import { nextExerciseAfterCompletion, updateWorkoutSet } from '@/services/training/workoutExecution';
import { sessionProgress, toSessionSetsByExercise, toWorkoutSession, type SessionSetsByExercise } from '@/services/training/sessionMapper';
import { workoutReview } from '@/services/training/workoutReview';
import { ExercisePage } from '@/components/train/ExercisePage';
import { WorkoutExerciseStrip } from '@/components/train/WorkoutExerciseStrip';
import { RestTimer } from '@/components/train/RestTimer';
import { IDLE_REST_TIMER, startRest } from '@/services/training/restTimer';
import { useWorkoutActivity } from '@/hooks/useWorkoutActivity';

const INITIAL = EXERCISE_CATALOGUE.slice(0, 7);
const context = { sessionId: 'fixture', userId: 'fixture', mesocycleId: 'fixture', microcycleId: 'fixture', microcycleIndex: 0, performedAt: 1 };
const makeSets = () => Object.fromEntries(INITIAL.map((exercise) => [exercise.id, Array.from({ length: 3 }, (_, index) => ({
  id: `${exercise.id}:${index}`, setType: index === 0 ? SetType.WARMUP : SetType.NORMAL,
  targetWeight: 20, targetReps: 10, targetRIR: 2, isAutoFilled: false, isCompleted: false,
}))]));

export default function WorkoutCheckScreen() {
  const { colors, typography, sectionAccent } = useTheme(); const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions(); const router = useRouter();
  const [exercises, setExercises] = useState(INITIAL); const [sets, setSets] = useState<SessionSetsByExercise>(makeSets);
  const [page, setPage] = useState(0); const [timer, setTimer] = useState(IDLE_REST_TIMER);
  const [activityEnabled, setActivityEnabled] = useState(false); const [activityEnded, setActivityEnded] = useState(false);
  const pager = useRef<ScrollView>(null); const progress = sessionProgress(sets);
  const review = workoutReview(exercises, sets, [], 'fixture');
  useWorkoutActivity(activityEnabled ? { ...context, sessionName: 'WORKOUT CHECK', trainingGoal: 'HYPERTROPHY', plannedSessionIndex: 0,
    activeExerciseId: exercises[page]?.id, restTimer: timer } : null, exercises, sets, activityEnded);
  const go = (index: number) => { setPage(index); pager.current?.scrollTo({ x: index * width, animated: true }); };
  const button = (label: string, onPress: () => void) => <Pressable accessibilityRole="button" onPress={onPress} style={{ padding: 10 }}>
    <Text style={{ color: sectionAccent.train }}>{label}</Text></Pressable>;
  return <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
    <Text style={[typography.emphasis, { color: colors.textPrimary, paddingHorizontal: 20 }]}>WORKOUT CHECK</Text>
    <Text style={{ color: colors.textSecondary, paddingHorizontal: 20 }}>Fixture only · no account writes · {progress.completed}/{progress.total} work sets</Text>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10 }}>
      {button('Resume snapshot', () => setSets(toSessionSetsByExercise(toWorkoutSession(context, exercises.map((ex) => ex.id), sets))))}
      {button('Test 3s alarm', () => setTimer(startRest('fixture', 3, Date.now())))}
      <RestTimer state={timer} onAdjust={() => {}} onRestart={() => setTimer(startRest('fixture', 3, Date.now()))} onCancel={() => setTimer(IDLE_REST_TIMER)} onSetDuration={() => {}} />
    </View>
    <WorkoutExerciseStrip exercises={exercises} activeId={exercises[page]?.id} onSelect={go} onAdd={() => {}} onReorder={(next) => {
      const id = exercises[page]?.id; setExercises(next); go(Math.max(0, next.findIndex((ex) => ex.id === id)));
    }} />
    <ScrollView horizontal pagingEnabled ref={pager} onMomentumScrollEnd={(event) => setPage(Math.round(event.nativeEvent.contentOffset.x / width))}>
      {exercises.map((exercise, exerciseIndex) => <ExercisePage key={exercise.id} active={exerciseIndex === page} exercise={exercise} sets={sets[exercise.id] ?? []} scale="RIR" width={width} bottomInset={0}
        onPressSetType={() => {}} onAddSet={() => {}} onRemoveSet={(id, setId) => setSets((old) => ({ ...old, [id]: old[id].filter((row) => row.id !== setId) }))}
        onUpdateSet={(id, setId, patch) => {
          const next = { ...sets, [id]: sets[id].map((row) => row.id === setId ? updateWorkoutSet(row, patch) : row) };
          setSets(next);
          if (patch.isCompleted) { const following = nextExerciseAfterCompletion(exercises.map((ex) => ex.id), next, id); if (following !== null) go(following); }
        }} />)}
    </ScrollView>
    <Text style={{ color: colors.textPrimary, padding: 12 }}>Review: {review.completed} work sets · {review.pending} pending · {review.tonnage} kg × reps</Text>
    {!activityEnabled && button('Test lock-screen activity', () => setActivityEnabled(true))}
    {button(activityEnabled && !activityEnded ? 'End test activity' : 'Back (discard fixture)', () => {
      if (activityEnabled && !activityEnded) setActivityEnded(true); else router.replace('/(tabs)/(train)');
    })}
  </View>;
}
