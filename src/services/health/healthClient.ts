import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { File, Paths } from 'expo-file-system';
import { WorkoutHealthExport, type HealthBridge } from './workoutExport';

const native = Platform.OS === 'ios' ? requireOptionalNativeModule<HealthBridge>('VigorHealth') : null;
const unavailable: HealthBridge = {
  authorization: async () => 'unavailable', authorize: async () => 'unavailable',
  saveWorkout: async () => { throw Error('HealthKit unavailable'); }, deleteWorkout: async () => { throw Error('HealthKit unavailable'); },
};
export const workoutHealth = new WorkoutHealthExport({
  read: async () => { if (Platform.OS === 'web') return null; const file = new File(Paths.document, 'vigor-health-exports.json'); return file.exists ? file.textSync() : null; },
  write: async (value) => {
    const temporary = new File(Paths.document, 'vigor-health-exports.pending');
    temporary.create({ overwrite: true }); temporary.write(value);
    temporary.move(new File(Paths.document, 'vigor-health-exports.json'), { overwrite: true });
  },
}, native ?? unavailable);
