import { useContext } from 'react';
import { TrainingUnitsContext } from './TrainingUnitsContext';
import { displayLoad, storedLoad } from '@/services/training/numericWheel';

/** Presentation only: persisted loads and all business calculations stay in kg. */
export function useTrainingUnits() {
  const { unit, increment } = useContext(TrainingUnitsContext);
  return { unit, increment,
    display: (kg: number | undefined) => kg === undefined ? undefined : displayLoad(kg, unit),
    store: (value: number | undefined) => value === undefined ? undefined : storedLoad(value, unit) };
}
