import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { formatWorkoutTime, workoutElapsedSeconds } from '@/services/training/workoutRuntime';

/** Owns its tick so a clock update does not repaint the exercise pages. */
export function WorkoutClock({ startedAt, completedAt }: { startedAt: number; completedAt?: number }) {
  const { colors, typography } = useTheme();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (completedAt !== undefined) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [startedAt, completedAt]);
  return <Text style={[typography.caption, { color: colors.textSecondary, fontVariant: ['tabular-nums'] }]}>
    {formatWorkoutTime(workoutElapsedSeconds(startedAt, now, completedAt))}
  </Text>;
}
