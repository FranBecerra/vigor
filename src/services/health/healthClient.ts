import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { File, Paths } from 'expo-file-system';
import { cardioCaptureKey, syncCardioCapture, type CardioCaptureBridge } from './cardioCapture';
import type { CardioWorkout } from '@/models/cardioTraining';
import { WorkoutHealthExport, type CardioHealthExport, type HealthBridge } from './workoutExport';

type NativeHealthBridge = Omit<HealthBridge, 'saveCardioWorkout'> & Partial<CardioCaptureBridge> & {
  healthJournalDirectory?: () => Promise<string>;
  saveCardioWorkout?: (workout: CardioHealthExport & { captureKey: string }) => ReturnType<NonNullable<HealthBridge['saveCardioWorkout']>>;
};
const native = Platform.OS === 'ios' ? requireOptionalNativeModule<NativeHealthBridge>('VigorHealth') : null;
const unavailable: HealthBridge = {
  authorization: async () => 'unavailable', authorize: async () => 'unavailable',
  saveWorkout: async () => { throw Error('HealthKit unavailable'); }, deleteWorkout: async () => { throw Error('HealthKit unavailable'); },
};
export const syncNativeCardioCapture = (workout: CardioWorkout, enabled: boolean, begin = false) =>
  syncCardioCapture(native, workout, enabled, begin);
export const discardNativeCardioCapture = () => { void native?.discardCardioCapture?.().catch(() => undefined); };

const mainJournal = 'vigor-health-exports.json';
const pendingJournal = 'vigor-health-exports.pending';
const journalDirectory = async () => await native?.healthJournalDirectory?.() ?? Paths.document;
function readJournalFile(directory: string | typeof Paths.document) {
  const file = new File(directory, mainJournal);
  if (file.exists) return file.textSync();
  // A failed overwrite can leave the pending file as the only journal copy.
  const pending = new File(directory, pendingJournal);
  return pending.exists ? pending.textSync() : null;
}

export const workoutHealth = new WorkoutHealthExport({
  read: async () => {
    if (Platform.OS === 'web') return null;
    // First read falls back to the legacy journal to retain the athlete's consent and queue.
    const directory = await journalDirectory();
    return readJournalFile(directory) ?? (directory !== Paths.document ? readJournalFile(Paths.document) : null);
  },
  write: async (value) => {
    const directory = await journalDirectory();
    const temporary = new File(directory, pendingJournal);
    temporary.create({ overwrite: true }); temporary.write(value);
    temporary.move(new File(directory, mainJournal), { overwrite: true });
  },
}, native ? {
  authorization: () => native.authorization(),
  authorize: () => native.authorize(),
  saveWorkout: workout => native.saveWorkout(workout),
  deleteWorkout: workout => native.deleteWorkout(workout),
  saveCardioWorkout: native.saveCardioWorkout ? workout => {
    const [owner, , id] = JSON.parse(workout.identity) as [string, string, string, number];
    return native.saveCardioWorkout!({ ...workout, captureKey: cardioCaptureKey(owner, id) });
  } : undefined,
} : unavailable);
