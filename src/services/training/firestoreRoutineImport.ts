/** Create-only atomic data import. Never changes an existing active routine. */
import type { Mesocycle, Routine } from '@/models';

export type FirestoreValue = { nullValue: null } | { stringValue: string } | { booleanValue: boolean }
  | { integerValue: string } | { doubleValue: number } | { arrayValue: { values: FirestoreValue[] } }
  | { mapValue: { fields: Record<string, FirestoreValue> } };
export function firestoreValue(value: unknown): FirestoreValue {
  if (value === null) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number' && Number.isFinite(value)) return Number.isSafeInteger(value)
    ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) {
    if (value.some(Array.isArray)) throw new Error('nestedFirestoreArray');
    return { arrayValue: { values: value.map(firestoreValue) } };
  }
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, firestoreValue(item)])) } };
  }
  throw new Error('invalidFirestoreValue');
}

export function routineImportCommit(project: string, documents: { routine: Routine; mesocycle: Mesocycle }) {
  const { routine, mesocycle } = documents;
  const safeId = (value: string) => typeof value === 'string' && value.length <= 1500
    && /^[A-Za-z0-9_.:-]+$/.test(value) && value !== '.' && value !== '..';
  if (!/^[a-z][a-z0-9-]+$/.test(project) || !safeId(routine.id) || !safeId(mesocycle.id)
    || !routine.userId || routine.userId !== mesocycle.userId || routine.activeMesocycleId !== mesocycle.id
    || mesocycle.routineId !== routine.id || routine.isActive !== false) throw new Error('unsafeRoutineImport');
  return { writes: ([['mesocycles', mesocycle], ['routines', routine]] as const).map(([collection, document]) => {
    const { id, ...data } = document;
    const encoded = firestoreValue(data);
    if (!('mapValue' in encoded)) throw new Error('invalidFirestoreDocument');
    return { update: { name: `projects/${project}/databases/(default)/documents/${collection}/${id}`, fields: encoded.mapValue.fields },
      currentDocument: { exists: false } };
  }) };
}
