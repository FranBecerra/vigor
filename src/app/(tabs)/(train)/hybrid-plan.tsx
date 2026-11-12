import { useEffect, useRef } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useExerciseCatalogue } from '@/hooks/useExerciseCatalogue';
import { HybridPlanBuilder } from '@/components/cardio/HybridPlanBuilder';
import { saveHybridBundle } from '@/services/cardio/hybridAuthoringRepository';
import { backToTraining } from '@/services/training/backNavigation';
import { ManualStrengthEditor } from './manual-routine';
import { StrengthPlanBuilder } from './generate';
import { collection, doc } from '@react-native-firebase/firestore';
import { db } from '@/services/firebase';
import { CardioPlanningHistoryProvider } from '@/components/cardio/CardioPlanningHistoryProvider';

export default function HybridPlanScreen() {
  const { uid } = useAuth();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  return <CardioPlanningHistoryProvider><OwnedHybridPlan key={uid ?? 'signed-out'} owner={uid} manual={mode === 'manual'} /></CardioPlanningHistoryProvider>;
}
function OwnedHybridPlan({ owner, manual }: { owner: string | null; manual: boolean }) {
  const router = useRouter(), { exercisesById } = useExerciseCatalogue(), live = useRef(false);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const newRoutineId = () => `hybrid-${doc(collection(db, 'routines')).id}`;
  return <><Stack.Screen options={{ gestureEnabled: false }} /><HybridPlanBuilder exercises={exercisesById} manual={manual} renderStrength={props => manual
    ? <ManualStrengthEditor embedded={{ ...props, newRoutineId, maxSessions: Math.min(7, props.sharedAvailability.trainingDays - (props.sharedAvailability.allowDoubles ? 0 : 1)) }} />
    : <StrengthPlanBuilder {...props} newRoutineId={newRoutineId} />} onCancel={() => backToTraining(router)} onSave={async bundle => {
    if (!owner || !live.current) throw Error('staleHybridOwner');
    await saveHybridBundle(bundle, owner, () => live.current);
    if (live.current) router.replace({ pathname: '/cardio-cycle', params: { id: bundle.cardio.id } });
  }} /></>;
}
