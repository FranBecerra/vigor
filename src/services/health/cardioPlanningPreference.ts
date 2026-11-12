import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

type Modality = 'RUNNING' | 'CYCLING';
export type CardioPlanningPreference = Partial<Record<Modality, number>>;

const fileFor = (owner: string) => new File(Paths.document, `vigor-cardio-planning-${encodeURIComponent(owner)}.json`);

export function parseCardioPlanningPreference(raw: unknown): CardioPlanningPreference {
  if (!raw || typeof raw !== 'object') return {};
  const result: CardioPlanningPreference = {};
  for (const modality of ['RUNNING', 'CYCLING'] as const) {
    const minutes = (raw as CardioPlanningPreference)[modality];
    if (minutes !== undefined && Number.isInteger(minutes) && minutes >= 1 && minutes <= 600) result[modality] = minutes;
  }
  return result;
}

export function readCardioPlanningPreference(owner: string): CardioPlanningPreference {
  if (Platform.OS !== 'ios') return {};
  try {
    const file = fileFor(owner);
    return file.exists ? parseCardioPlanningPreference(JSON.parse(file.textSync())) : {};
  } catch { return {}; }
}

/** Store only the athlete's declared comfortable duration and reuse choice. */
export function writeCardioPlanningPreference(owner: string, modality: Modality, minutes?: number) {
  if (Platform.OS !== 'ios') return false;
  try {
    const destination = fileFor(owner);
    const updated = { ...readCardioPlanningPreference(owner), [modality]: minutes };
    const temporary = new File(Paths.document, `vigor-cardio-planning-${encodeURIComponent(owner)}.pending`);
    temporary.create({ overwrite: true });
    temporary.write(JSON.stringify(parseCardioPlanningPreference(updated)));
    temporary.move(destination, { overwrite: true });
    return true;
  } catch { return false; }
}
