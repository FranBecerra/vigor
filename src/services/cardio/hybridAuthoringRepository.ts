import { collection, doc, runTransaction } from '@react-native-firebase/firestore';
import { authInstance, db } from '@/services/firebase';
import { firestoreData } from '@/services/repositories/firestoreData';
import { validHybridBundle, type HybridBundle } from './hybridAuthoring';

const canonical = (v: unknown): string => Array.isArray(v) ? `[${v.map(canonical).join(',')}]`
  : v && typeof v === 'object' ? `{${Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, item]) => `${JSON.stringify(k)}:${canonical(item)}`).join(',')}}` : JSON.stringify(v);

/** Three existing collections, one online transaction; no missing root-document reads. */
export async function saveHybridBundle(bundle: HybridBundle, owner: string, current: () => boolean) {
  const live = () => current() && authInstance.currentUser?.uid === owner;
  if (!live() || !validHybridBundle(bundle, owner)) throw Error('invalidHybridSave');
  const entries = [
    ['routines', bundle.routine], ['mesocycles', bundle.mesocycle], [`users/${owner}/cardioPlans`, bundle.cardio],
  ] as const;
  const writes = entries.map(([path, { id, ...data }]) => ({ reference: doc(collection(db, path), id), data: firestoreData(data) }));
  await runTransaction(db, async transaction => {
    if (!live()) throw Error('staleHybridOwner');
    // The owner-private proposal is also the atomic creation receipt. Unlike the
    // root collections, this path permits reading an absent document under current rules.
    const receipt = await transaction.get(writes[2].reference);
    if (!live()) throw Error('staleHybridOwner');
    if (receipt.exists()) {
      if (canonical(receipt.data()) !== canonical(writes[2].data)) throw Error('hybridTargetChanged');
      const snapshots = await Promise.all(writes.slice(0, 2).map(w => transaction.get(w.reference)));
      if (!live()) throw Error('staleHybridOwner');
      // A successful atomic receipt implies both owned roots exist. Never repair a
      // changed/deleted target by overwriting it; exact retries perform no writes.
      if (!snapshots.every((s, i) => s.exists() && canonical(s.data()) === canonical(writes[i].data))) throw Error('hybridTargetChanged');
      return;
    }
    writes.forEach(w => transaction.set(w.reference, w.data));
  });
  if (!live()) throw Error('staleHybridOwner');
}
