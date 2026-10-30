import { firestoreData } from '../firestoreData';

it('omits optional nested object fields without mutating values or dropping explicit nulls', () => {
  const source = { missing: undefined, overrides: { '0:0': { sets: [{ targetRIR: undefined, targetReps: 10 }], note: null } } };
  expect(firestoreData(source)).toEqual({ overrides: { '0:0': { sets: [{ targetReps: 10 }], note: null } } });
  expect(Object.hasOwn(source, 'missing')).toBe(true);
  expect(Object.hasOwn(source.overrides['0:0'].sets[0], 'targetRIR')).toBe(true);
  expect(firestoreData(Object.assign(Object.create(null), { present: 1, absent: undefined }))).toEqual({ present: 1 });
});
it('preserves dates and opaque native field sentinels rather than JSON-encoding them', () => {
  class Sentinel { constructor(public operation: string) {} }
  const date = new Date(1), sentinel = new Sentinel('delete');
  const result = firestoreData({ date, sentinel, value: 0, text: '', valid: false });
  expect(result.date).toBe(date); expect(result.sentinel).toBe(sentinel);
  expect(result).toMatchObject({ value: 0, text: '', valid: false });
  expect(firestoreData(null)).toBeNull();
});
it('rejects undefined array entries and holes rather than silently changing order or inventing nulls', () => {
  expect(() => firestoreData({ sets: [undefined] })).toThrow('Undefined array entry');
  expect(() => firestoreData(Array(1))).toThrow('Undefined array entry');
});
