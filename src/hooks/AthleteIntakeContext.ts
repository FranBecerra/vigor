import { createContext, useContext } from 'react';
import type { AthleteIntake } from '@/services/settings/athleteIntake';

/** Read-only optional context keeps standalone planners and native fixtures reusable. */
export const AthleteIntakeContext = createContext<{ ready: boolean; error?: boolean; reload?: () => void; intake?: AthleteIntake }>({ ready: true });
export const useAthleteIntakeDefaults = () => useContext(AthleteIntakeContext).intake;
export const useAthleteIntakeReady = () => useContext(AthleteIntakeContext).ready;
export const useAthleteIntakeState = () => useContext(AthleteIntakeContext);
