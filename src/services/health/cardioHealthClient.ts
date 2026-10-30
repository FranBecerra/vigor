import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import type { CardioHealthBridge, CardioHealthRead } from '@/models/cardioHealth';

interface NativeCardio { cardioHistoryAvailable(): Promise<boolean>; authorizeCardioHistory(): Promise<void>; readCardioHistory(start: number, end: number): Promise<CardioHealthRead> }
const native = Platform.OS === 'ios' ? requireOptionalNativeModule<Partial<NativeCardio>>('VigorHealth') : null;
/** Availability is not consent. No mount, profile or planning action invokes authorization. */
export const cardioHealthBridge: CardioHealthBridge = {
  available: async () => typeof native?.cardioHistoryAvailable === 'function' && typeof native?.authorizeCardioHistory === 'function'
    && typeof native?.readCardioHistory === 'function' && await native.cardioHistoryAvailable(),
  authorize: async () => { if (!native?.authorizeCardioHistory) throw Error('cardioHealthUnavailable'); await native.authorizeCardioHistory(); },
  read: async (start, end) => { if (!native?.readCardioHistory) throw Error('cardioHealthUnavailable'); return native.readCardioHistory(start, end); },
};
