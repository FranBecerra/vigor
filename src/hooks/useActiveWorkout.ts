import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from './useAuth';
import { workoutSessionRepository } from '@/services/repositories';
import { latestUnfinishedWorkout } from '@/services/training/workoutRuntime';
import type { WorkoutSession } from '@/models';

export function useActiveWorkout() {
  const { uid } = useAuth();
  const [active, setActive] = useState<WorkoutSession | null>(null);
  const request = useRef(0);
  useFocusEffect(useCallback(() => {
    const id = ++request.current;
    setActive(null);
    if (uid) void workoutSessionRepository.listByUser(uid).then((sessions) => {
      if (id === request.current) setActive(latestUnfinishedWorkout(sessions));
    }).catch(() => {});
    return () => { ++request.current; };
  }, [uid]));
  return active;
}
