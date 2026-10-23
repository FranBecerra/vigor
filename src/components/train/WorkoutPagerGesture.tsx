import { createContext, useContext } from 'react';
import type { Gesture } from 'react-native-gesture-handler';

/** Set rows make the enclosing native pager wait until their swipe has failed. */
export const WorkoutPagerGestureContext = createContext<ReturnType<typeof Gesture.Native> | null>(null);
export const useWorkoutPagerGesture = () => useContext(WorkoutPagerGestureContext);
