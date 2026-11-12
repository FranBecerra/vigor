import { useLocalSearchParams } from 'expo-router';
import { ManualCardioPlanFlow } from '@/components/cardio/ManualCardioPlanFlow';
import { CardioPlanFlow } from '@/components/cardio/CardioPlanFlow';
import { CardioPlanningHistoryProvider } from '@/components/cardio/CardioPlanningHistoryProvider';

export default function CardioPlanScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  if (mode === 'manual') return <ManualCardioPlanFlow />;
  return <CardioPlanningHistoryProvider><CardioPlanFlow /></CardioPlanningHistoryProvider>;
}
