import { collection, doc, getDocFromCache } from '@react-native-firebase/firestore';
import type { CardioBlock, CardioWorkout } from '@/models/cardioTraining';
import { db } from '../firebase';
import { BaseRepository } from '../repositories/BaseRepository';
import { validSportIdentity } from './sportActivities';

export type CardioCollection = 'cardioBlocks' | 'cardioWorkouts';
export type CardioEntity = CardioBlock | CardioWorkout;
export function cardioTrainingPath(owner: string, collection: CardioCollection) {
  if (!validSportIdentity(owner) || !['cardioBlocks', 'cardioWorkouts'].includes(collection)) throw Error('invalidCardioOwner');
  return `users/${owner}/${collection}`;
}
export class CardioTrainingRepository<T extends CardioEntity> extends BaseRepository<T> {
  constructor(private owner: string, collectionName: CardioCollection, private validate: (value: unknown, owner: string) => value is T) { super(cardioTrainingPath(owner, collectionName)); }
  newId() { return doc(collection(db, this.collectionPath)).id; }
  async save(next: T, previous: T | null, current: () => boolean, rejected: () => void) {
    if (!current() || !this.validate(next, this.owner)) throw Error('invalidCardioRecord');
    if (previous) {
      if (!this.validate(previous, this.owner) || previous.id !== next.id || next.revision !== previous.revision + 1 || next.updatedAt < previous.updatedAt) throw Error('staleCardioRecord');
      // Compare the latest locally observed revision without a server round-trip on pause/resume.
      // A missing cache entry is uncertain, not permission to replace a document.
      const snapshot = await getDocFromCache(this.ref(previous.id));
      const latest = snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } : null;
      if (!current() || !this.validate(latest, this.owner) || latest.id !== previous.id || latest.revision !== previous.revision) throw Error('staleCardioRecord');
    } else if (next.revision !== 1) throw Error('invalidCardioRecord');
    if (!current()) throw Error('staleCardioOwner');
    let failed = false;
    await this.createLocally(next, undefined, () => { failed = true; if (current()) rejected(); });
    if (failed || !current()) throw Error('cardioSaveFailed');
    return next;
  }
}
