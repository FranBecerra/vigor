import { parseCardioPlanningPreference, readCardioPlanningPreference, writeCardioPlanningPreference } from '../cardioPlanningPreference';

const mockFiles = new Map<string, string>();
let mockPlatform = 'ios';
jest.mock('react-native', () => ({ Platform: { get OS() { return mockPlatform; } } }));
jest.mock('expo-file-system', () => ({ Paths: { document: 'fixture' }, File: class {
  private name: string;
  constructor(_directory: string, name: string) { this.name = name; }
  get exists() { return mockFiles.has(this.name); }
  textSync() { return mockFiles.get(this.name)!; }
  create() { mockFiles.set(this.name, ''); }
  write(text: string) { mockFiles.set(this.name, text); }
  move(target: { name: string }) { mockFiles.set(target.name, this.textSync()); mockFiles.delete(this.name); }
} }));

beforeEach(() => { mockFiles.clear(); mockPlatform = 'ios'; });

it('keeps only valid declared durations and strips unrelated fields', () => {
  expect(parseCardioPlanningPreference(undefined)).toEqual({});
  expect(parseCardioPlanningPreference({ RUNNING: 40, CYCLING: -1, workouts: ['sensitive'] })).toEqual({ RUNNING: 40 });
  expect(parseCardioPlanningPreference({ RUNNING: '40', CYCLING: 601 })).toEqual({});
});

it('stores independent consent by athlete and activity and supports revocation', () => {
  expect(readCardioPlanningPreference('one')).toEqual({});
  expect(writeCardioPlanningPreference('one', 'RUNNING', 40)).toBe(true);
  expect(writeCardioPlanningPreference('one', 'CYCLING', 70)).toBe(true);
  expect(writeCardioPlanningPreference('two', 'RUNNING', 20)).toBe(true);
  expect(readCardioPlanningPreference('one')).toEqual({ RUNNING: 40, CYCLING: 70 });
  expect(readCardioPlanningPreference('two')).toEqual({ RUNNING: 20 });
  expect(writeCardioPlanningPreference('one', 'RUNNING')).toBe(true);
  expect(readCardioPlanningPreference('one')).toEqual({ CYCLING: 70 });
  mockPlatform = 'web';
  expect(readCardioPlanningPreference('one')).toEqual({});
  expect(writeCardioPlanningPreference('one', 'RUNNING', 40)).toBe(false);
});
