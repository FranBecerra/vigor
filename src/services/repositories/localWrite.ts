/** Resolve on the native local snapshot, never wait for a network acknowledgment. */
import { onSnapshot, setDoc, type DocumentReference } from '@react-native-firebase/firestore';

export function writeLocally(ref: DocumentReference, data: Record<string, unknown>, token: string,
  onSynced?: () => void, onRejected?: (error: unknown) => void, merge = false): Promise<'pending' | 'synced'> {
  return new Promise((resolve, reject) => {
    let accepted = false;
    let unsubscribe: (() => void) | undefined;
    let stopRequested = false;
    const stop = () => { stopRequested = true; unsubscribe?.(); };
    const fail = (error: unknown) => { stop(); if (!accepted) reject(error); else onRejected?.(error); };
    unsubscribe = onSnapshot(ref, { includeMetadataChanges: true }, (snapshot) => {
      if (!snapshot.exists() || snapshot.data()?._clientWriteId !== token) return;
      accepted = true;
      stop();
      resolve(snapshot.metadata.hasPendingWrites ? 'pending' : 'synced');
    }, fail);
    if (stopRequested) unsubscribe();
    try {
      const payload = { ...data, _clientWriteId: token };
      const writing = merge ? setDoc(ref, payload, { merge: true }) : setDoc(ref, payload);
      void writing.then(() => {
        stop();
        if (!accepted) { accepted = true; resolve('synced'); }
        onSynced?.();
      }).catch(fail);
    } catch (error) { fail(error); }
  });
}
