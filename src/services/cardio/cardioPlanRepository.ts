import { collection, doc } from '@react-native-firebase/firestore';
import { db } from '../firebase';
import { BaseRepository } from '../repositories/BaseRepository';
import { validSportIdentity } from './sportActivities';
import { archiveCardioProposal, validSavedCardioPlan, type SavedCardioPlan } from './savedCardioPlan';

export function cardioPlanPath(owner: string): string {
  if (!validSportIdentity(owner)) throw Error('invalidCardioOwner');
  return `users/${owner}/cardioPlans`;
}

/** Existing private owner-only rules; no infrastructure or rules deployment. */
export class CardioPlanRepository extends BaseRepository<SavedCardioPlan> {
  constructor(private readonly owner: string) { super(cardioPlanPath(owner)); }
  newId(): string { return doc(collection(db, cardioPlanPath(this.owner))).id; }
  async save(plan: SavedCardioPlan, current: () => boolean, rejected: () => void) {
    if (!current() || !validSavedCardioPlan(plan, this.owner) || plan.archivedAt !== null) throw Error('invalidCardioPlan');
    let failed = false;
    await this.createLocally(plan, undefined, () => { failed = true; if (current()) rejected(); });
    if (failed || !current()) throw Error('cardioSaveFailed');
    return plan;
  }
  async archive(plan: SavedCardioPlan, now: number, current: () => boolean, rejected: () => void) {
    const next = archiveCardioProposal(plan, this.owner, now);
    if (!current()) throw Error('staleCardioOwner');
    const latest = await this.get(plan.id);
    if (!current() || !validSavedCardioPlan(latest, this.owner) || latest.archivedAt !== null || latest.createdAt !== plan.createdAt) throw Error('staleCardioPlan');
    let failed = false;
    // Bounded patch cannot overwrite immutable plan content or restore a newer edit.
    await this.updateLocally(plan.id, { archivedAt: next.archivedAt }, () => { failed = true; if (current()) rejected(); });
    if (failed || !current()) throw Error('cardioSaveFailed');
    return next;
  }
}
