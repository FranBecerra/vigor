import { collection, doc } from '@react-native-firebase/firestore';
import type { SportActivity, SportActivityDraft, SportActivitySeries } from '@/models/sportActivity';
import { db } from '../firebase';
import { BaseRepository } from '../repositories/BaseRepository';
import { discardSportActivity, saveSportDraft, validSportActivity, validSportIdentity } from './sportActivities';
import { createSportActivitySeries, validSportActivitySeries } from './sportActivitySeries';

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
    const document: unknown = await this.get(original.occurrence?.seriesId ?? id);
    const latest = original.occurrence
      ? validSportActivitySeries(document, this.owner) ? document.occurrences[String(original.occurrence.index)] : null
      : document;
    if (!isCurrent() || !validSportActivity(latest, this.owner) || latest.revision !== original.revision) throw Error('staleSportActivity');
    return latest;
  }

  async save(id: string, original: SportActivity | null, draft: SportActivityDraft, now: number,
    isCurrent: () => boolean, onRejected: () => void): Promise<SportActivity | SportActivity[]> {
    if (draft.repeat !== undefined) {
      if (original || !isCurrent()) throw Error('invalidSportRecurrence');
      const series = createSportActivitySeries(id, this.owner, draft, now);
      // A single native-persisted write accepts every occurrence or none.
      await this.persistSeries(series, isCurrent, onRejected);
      return Object.values(series.occurrences);
    }
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
    const reject = () => { rejected = true; if (isCurrent()) onRejected(); };
    if (entry.occurrence) {
      // Merge just this occurrence's leaf map; never replace sibling records.
      await new BaseRepository<SportActivitySeries>(sportActivityPath(this.owner)).updateLocally(entry.occurrence.seriesId,
        { occurrences: { [String(entry.occurrence.index)]: entry } }, reject);
    } else await this.createLocally(entry, undefined, reject);
    if (rejected || !isCurrent()) throw Error('sportSaveFailed');
  }

  private async persistSeries(series: SportActivitySeries, isCurrent: () => boolean, onRejected: () => void) {
    if (!isCurrent()) throw Error('staleSportActivity');
    let rejected = false;
    await new BaseRepository<SportActivitySeries>(sportActivityPath(this.owner)).createLocally(series, undefined,
      () => { rejected = true; if (isCurrent()) onRejected(); });
    if (rejected || !isCurrent()) throw Error('sportSaveFailed');
  }
}
