import { collection, doc } from '@react-native-firebase/firestore';
import type { SportActivity, SportActivityDraft } from '@/models/sportActivity';
import { db } from '../firebase';
import { BaseRepository } from '../repositories/BaseRepository';
import { discardSportActivity, saveSportDraft, validSportActivity, validSportIdentity } from './sportActivities';

/** Reuses the existing owner-only users/{uid}/... rule and native local persistence. */
export function sportActivityPath(owner: string): string {
  if (!validSportIdentity(owner)) throw Error('invalidSportOwner');
  return `users/${owner}/sportActivities`;
}

export class SportActivityRepository extends BaseRepository<SportActivity> {
  constructor(private readonly owner: string) { super(sportActivityPath(owner)); }
  newId(): string { return doc(collection(db, sportActivityPath(this.owner))).id; }

  private async checkOriginal(id: string, original: SportActivity, isCurrent: () => boolean) {
    if (!isCurrent() || !validSportActivity(original, this.owner) || original.id !== id) throw Error('staleSportActivity');
    const latest = await this.get(id);
    if (!isCurrent() || !validSportActivity(latest, this.owner) || latest.revision !== original.revision) throw Error('staleSportActivity');
    return latest;
  }

  async save(id: string, original: SportActivity | null, draft: SportActivityDraft, now: number,
    isCurrent: () => boolean, onRejected: () => void): Promise<SportActivity> {
    // New auto IDs can be queued offline without reading a nonexistent document.
    const latest = original ? await this.checkOriginal(id, original, isCurrent) : null;
    const entry = saveSportDraft(id, this.owner, draft, now, latest ?? undefined);
    await this.persist(entry, isCurrent, onRejected);
    return entry;
  }

  async discard(original: SportActivity, now: number, isCurrent: () => boolean, onRejected: () => void) {
    const latest = await this.checkOriginal(original.id, original, isCurrent);
    const entry = discardSportActivity(latest!, this.owner, now);
    await this.persist(entry, isCurrent, onRejected);
    return entry;
  }

  private async persist(entry: SportActivity, isCurrent: () => boolean, onRejected: () => void) {
    if (!isCurrent()) throw Error('staleSportActivity');
    let rejected = false;
    await this.createLocally(entry, undefined, () => { rejected = true; if (isCurrent()) onRejected(); });
    if (rejected || !isCurrent()) throw Error('sportSaveFailed');
  }
}
