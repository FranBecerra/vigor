import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import type { BioHealthBridge } from '@/models/bioHealth';
import type { BioNightBridge, BioNightRead } from '@/models/bioNight';

interface NightNative { bioNightAvailable(): Promise<boolean>; authorizeBioNight(): Promise<void>; readBioNight(start: number, end: number): Promise<BioNightRead> }
const native = Platform.OS === 'ios' ? requireOptionalNativeModule<Partial<BioHealthBridge & NightNative>>('VigorHealth') : null;
/** Old binaries stay usable. Authorization is invoked only by an explicit Settings action. */
export const bioHealthBridge: BioHealthBridge = {
  bioAvailable: async () => typeof native?.readBio === 'function' && typeof native?.authorizeBio === 'function'
    && typeof native?.bioAvailable === 'function' && await native.bioAvailable(),
  authorizeBio: async () => { if (!native?.authorizeBio) throw Error('bioHealthUnavailable'); await native.authorizeBio(); },
  readBio: async (start, end) => { if (!native?.readBio) throw Error('bioHealthUnavailable'); return native.readBio(start, end); },
};
/** Separate opt-in; legacy Bio consent does not activate these additional read types. */
export const bioNightBridge: BioNightBridge = {
  available: async () => typeof native?.readBioNight === 'function' && typeof native?.authorizeBioNight === 'function'
    && typeof native?.bioNightAvailable === 'function' && await native.bioNightAvailable(),
  authorize: async () => { if (!native?.authorizeBioNight) throw Error('bioNightUnavailable'); await native.authorizeBioNight(); },
  read: async (start, end) => { if (!native?.readBioNight) throw Error('bioNightUnavailable'); return native.readBioNight(start, end); },
};
