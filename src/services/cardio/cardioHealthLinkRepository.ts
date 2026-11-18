import { collection, doc, runTransaction } from '@react-native-firebase/firestore';
import type { CardioBlock, CardioWorkout } from '@/models/cardioTraining';
import { db } from '@/services/firebase';
import { cardioTrainingPath } from './cardioTrainingRepository';
import { validCardioBlock } from './cardioBlock';
import { validCardioWorkout } from './cardioWorkout';
import { validSportIdentity } from './sportActivities';

/** Reserve both the external workout and the opportunity before writing the result. */
export async function saveCardioHealthLink(next: CardioWorkout, block: CardioBlock, current: () => boolean): Promise<void> {
  const owner = block.userId;
  if (!current() || !validCardioWorkout(next, owner) || next.source !== 'APPLE_HEALTH_LINK_V1'
    || next.blockId !== block.id || next.revision !== 1 || next.status !== 'FINISHED') throw Error('invalidHealthCardioLink');
  const workouts = collection(db, cardioTrainingPath(owner, 'cardioWorkouts'));
  const blockRef = doc(collection(db, cardioTrainingPath(owner, 'cardioBlocks')), block.id);
  const claims = collection(db, `users/${owner}/cardioHealthLinks`);
  const refs = [doc(claims, `workout:${next.healthLinkKey}`),
    doc(claims, `slot:${block.id.length}:${block.id}:${next.slotId}`)];
  await runTransaction(db, async transaction => {
    const latest = await transaction.get(blockRef);
    const fresh = latest.exists() ? { ...latest.data(), id: latest.id } : null;
    if (!current() || !validCardioBlock(fresh, owner) || fresh.endedAt !== null || fresh.revision !== block.revision
      || !fresh.slots.some(s => s.id === next.slotId && s.disposition === 'CARDIO')) throw Error('staleCardioRecord');
    const claimSnapshots = await Promise.all(refs.map(ref => transaction.get(ref)));
    let idempotent = false;
    for (const claim of claimSnapshots) {
      if (!claim.exists()) continue;
      const id = claim.data()?.workoutId;
      if (!validSportIdentity(id)) throw Error('invalidHealthCardioLink');
      const existing = await transaction.get(doc(workouts, id));
      const workout = existing.exists() ? { ...existing.data(), id } : null;
      if (!validCardioWorkout(workout, owner) || workout.source !== 'APPLE_HEALTH_LINK_V1') throw Error('invalidHealthCardioLink');
      if (workout.status === 'DISCARDED') continue;
      if (workout.healthLinkKey === next.healthLinkKey && workout.blockId === next.blockId && workout.slotId === next.slotId) {
        idempotent = true;
      } else throw Error('healthCardioAlreadyLinked');
    }
    if (idempotent) return;
    const target = doc(workouts, next.id);
    if ((await transaction.get(target)).exists()) throw Error('invalidHealthCardioLink');
    if (!current()) throw Error('staleCardioOwner');
    const { id, ...data } = next;
    transaction.set(target, data);
    refs.forEach(ref => transaction.set(ref, { workoutId: id }));
  });
}
