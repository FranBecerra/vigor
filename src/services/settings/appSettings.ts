import { validSleepGoal } from '@/services/bio/sleepGoal';

export type AppAppearance = 'system' | 'light' | 'dark';
export type AppLanguage = 'system' | 'en' | 'es' | 'fr' | 'ja';
export interface AppSettings { appearance: AppAppearance; language: AppLanguage; measurementSystem?: 'metric' | 'imperial'; weightIncrement?: number; bioHealthEnabled?: boolean; bioNightEnabled?: boolean; bioSleepGoalMinutes?: number }
export const DEFAULT_APP_SETTINGS: Readonly<AppSettings> = { appearance: 'system', language: 'system' };
export interface SettingsStorage { read(): Promise<string | null>; write(text: string): Promise<void> }

export function validateAppSettings(value: unknown): AppSettings {
  const data = value as AppSettings;
  if (!data || !['system', 'light', 'dark'].includes(data.appearance) || !['system', 'en', 'es', 'fr', 'ja'].includes(data.language)) throw Error('Invalid app settings');
  if (data.measurementSystem !== undefined && !['metric', 'imperial'].includes(data.measurementSystem)) throw Error('Invalid measurement system');
  if (data.weightIncrement !== undefined && (!Number.isFinite(data.weightIncrement) || data.weightIncrement < 0.01 || data.weightIncrement > 100)) throw Error('Invalid weight increment');
  if (data.bioHealthEnabled !== undefined && typeof data.bioHealthEnabled !== 'boolean') throw Error('Invalid Bio connection');
  if (data.bioNightEnabled !== undefined && typeof data.bioNightEnabled !== 'boolean') throw Error('Invalid overnight connection');
  if (data.bioSleepGoalMinutes !== undefined && !validSleepGoal(data.bioSleepGoalMinutes)) throw Error('Invalid sleep goal');
  return { appearance: data.appearance, language: data.language,
    ...(data.measurementSystem === undefined ? {} : { measurementSystem: data.measurementSystem }),
    ...(data.weightIncrement === undefined ? {} : { weightIncrement: data.weightIncrement }),
    ...(data.bioHealthEnabled === undefined ? {} : { bioHealthEnabled: data.bioHealthEnabled }),
    ...(data.bioNightEnabled === undefined ? {} : { bioNightEnabled: data.bioNightEnabled }),
    ...(data.bioSleepGoalMinutes === undefined ? {} : { bioSleepGoalMinutes: data.bioSleepGoalMinutes }) };
}
export function normalizeDisplayName(input: string): string {
  if (typeof input !== 'string' || /[\u0000-\u001f\u007f-\u009f]/u.test(input)) throw Error('Invalid display name');
  const value = input.normalize('NFC').trim().replace(/\s+/gu, ' ');
  if (!value || Array.from(value).length > 40) throw Error('Display name must contain 1–40 characters');
  return value;
}
function documentFrom(text: string | null): Record<string, AppSettings> {
  if (text === null) return {};
  const data = JSON.parse(text);
  if (data?.version !== 1 || !data.owners || typeof data.owners !== 'object' || Array.isArray(data.owners)) throw Error('Invalid settings storage');
  return Object.fromEntries(Object.entries(data.owners).map(([owner, settings]) => {
    if (!owner) throw Error('Missing settings owner');
    return [owner, validateAppSettings(settings)];
  }));
}
/** Read-modify-write serialization prevents rapid choices from losing another field/account. */
export class AppSettingsRepository {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private storage: SettingsStorage) {}
  private run<T>(action: () => Promise<T>): Promise<T> {
    const next = this.queue.catch(() => undefined).then(action); this.queue = next; return next;
  }
  get(owner: string): Promise<AppSettings> {
    return this.run(async () => {
      if (!owner) throw Error('Missing settings owner');
      const document = documentFrom(await this.storage.read());
      return { ...(Object.hasOwn(document, owner) ? document[owner] : DEFAULT_APP_SETTINGS) };
    });
  }
  update(owner: string, patch: Partial<AppSettings>): Promise<AppSettings> {
    return this.run(async () => {
      if (!owner) throw Error('Missing settings owner');
      const document = documentFrom(await this.storage.read());
      const next = validateAppSettings({ ...(Object.hasOwn(document, owner) ? document[owner] : DEFAULT_APP_SETTINGS), ...patch });
      const owners = Object.fromEntries([...Object.entries(document), [owner, next]]);
      await this.storage.write(JSON.stringify({ version: 1, owners })); return next;
    });
  }
}
