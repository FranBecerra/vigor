/** Omit absent optional object fields without converting native Firestore values or nulls. */
export function firestoreData<T>(value: T): T {
  if (Array.isArray(value)) return Array.from(value, item => {
    if (item === undefined) throw Error('Undefined array entry');
    return firestoreData(item);
  }) as T;
  if (value !== null && typeof value === 'object'
    && [Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, firestoreData(item)])) as T;
  }
  return value;
}
