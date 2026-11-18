import { parseAgendaOrder, readAgendaPreference, removeAgendaRest, writeAgendaPreference } from '../agendaOrderPreference';

const mockFiles = new Map<string, string>();
jest.mock('expo-file-system', () => ({
  Paths: { document: 'documents' },
  File: class {
    name: string;
    constructor(_folder: string, name: string) { this.name = name; }
    get exists() { return mockFiles.has(this.name); }
    textSync() { return mockFiles.get(this.name); }
    create() { mockFiles.set(this.name, ''); }
    write(value: string) { mockFiles.set(this.name, value); }
    move(destination: { name: string }) {
      mockFiles.set(destination.name, mockFiles.get(this.name)!);
      mockFiles.delete(this.name);
    }
  },
}));
const move = { id: 'run', anchor: 'legs', direction: -1 as const };

it('stores only valid bounded relative moves and survives rereading per owner', () => {
  expect(parseAgendaOrder([null, { ...move, direction: 0 }, move, { ...move, anchor: 'run' }])).toEqual([move]);
  expect(parseAgendaOrder(Array(200).fill(move))).toHaveLength(128);
  mockFiles.set('vigor-agenda-first.json', JSON.stringify([move]));
  expect(readAgendaPreference('first')).toEqual({ moves: [move], rests: [] });
  const rest = { id: 'extra-rest', scope: 'strength:meso:0', checked: true };
  const preference = { moves: [move], rests: [rest] };
  expect(writeAgendaPreference('first', { ...preference, rests: [{ ...rest, checked: false }, rest] })).toEqual(preference);
  expect(readAgendaPreference('first')).toEqual(preference);
  expect(readAgendaPreference('second')).toEqual({ moves: [], rests: [] });
  mockFiles.set('vigor-agenda-first.json', 'invalid');
  expect(readAgendaPreference('first')).toEqual({ moves: [], rests: [] });
});

it('persists a scheduled rest removal by occurrence and removes an added rest and its order entries', () => {
  const rest = { id: 'extra-rest', scope: 'strength:meso:0', checked: true };
  const preference = { rests: [rest], moves: [move, { ...move, anchor: rest.id }] };
  const withoutExtra = removeAgendaRest(preference, { ...rest, kind: 'rest', extra: true });
  expect(withoutExtra).toEqual({ rests: [], moves: [move] });
  const planned = { kind: 'rest' as const, id: 'rest:meso:0:rest-1', mesocycleId: 'meso', cycle: 0, restDayId: 'rest-1', checked: false };
  const withoutPlanned = removeAgendaRest(removeAgendaRest(withoutExtra, planned), planned);
  writeAgendaPreference('rest-owner', withoutPlanned);
  expect(readAgendaPreference('rest-owner')).toEqual({ ...withoutExtra, removedRestIds: [planned.id] });
});
