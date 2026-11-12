import { collection, doc, getDocFromServer, getDocsFromServer, query, runTransaction, where } from '@react-native-firebase/firestore';
import type { Mesocycle, Routine, WorkoutSession } from '@/models';
import { authInstance, db } from '@/services/firebase';
import { firestoreData } from '@/services/repositories/firestoreData';
import { previewMesocycleSuccessor, reviewMesocycleClosure, type ClosureReason } from './mesocycleContinuity';

const routines = () => collection(db, 'routines');
const blocks = () => collection(db, 'mesocycles');
const workouts = () => collection(db, 'workoutSessions');

function ownerIsCurrent(owner: string) {
  return !!owner && authInstance.currentUser?.uid === owner;
}

const version = (value: Mesocycle['updatedAt'] | undefined) => typeof value === 'number'
  ? value : value ? value.seconds * 1000 + value.nanoseconds / 1_000_000 : 0;

// Snapshot dictionaries may arrive in a different key order via a transaction.
const signature = (value: unknown) => JSON.stringify(value, (_key, item) =>
  item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);

function reviewedRecords(history: readonly WorkoutSession[]) {
  return [...history].sort((a, b) => a.id.localeCompare(b.id)).map(record => [
    record.id, record.editedAt, record.performedAt, record.completedAt, record.discardedAt,
    record.microcycleIndex, record.plannedSessionIndex, record.exercises, record.supersets,
  ]);
}

function sourceHistory(owner: string, sourceId: string) {
  return getDocsFromServer(query(workouts(), where('userId', '==', owner), where('mesocycleId', '==', sourceId)));
}

export async function loadContinuityReview(owner: string, routineId: string, sourceId: string) {
  if (!ownerIsCurrent(owner)) throw Error('staleContinuityOwner');
  const [routineDoc, sourceDoc, records, related] = await Promise.all([
    getDocFromServer(doc(routines(), routineId)), getDocFromServer(doc(blocks(), sourceId)),
    sourceHistory(owner, sourceId),
    getDocsFromServer(query(blocks(), where('userId', '==', owner), where('routineId', '==', routineId))),
  ]);
  const routine = { ...routineDoc.data(), id: routineId } as Routine;
  const source = { ...sourceDoc.data(), id: sourceId } as Mesocycle;
  if (!ownerIsCurrent(owner) || !routineDoc.exists() || !sourceDoc.exists() || routine.userId !== owner
    || routine.hybrid || routine.isActive !== true || routine.activeMesocycleId !== sourceId
    || source.userId !== owner || source.routineId !== routineId) throw Error('staleContinuity');
  if (records.metadata.hasPendingWrites || sourceDoc.metadata.hasPendingWrites || routineDoc.metadata.hasPendingWrites) throw Error('continuityPendingWrites');
  const priorBlocks = related.docs.filter(snapshot => snapshot.id !== sourceId &&
    ['COMPLETED', 'INTERRUPTED'].includes(snapshot.data().status))
    .sort((a, b) => version(b.data().startedAt) - version(a.data().startedAt) || a.id.localeCompare(b.id)).slice(0, 3);
  const prior = await Promise.all(priorBlocks.map(block => sourceHistory(owner, block.id)));
  if (!ownerIsCurrent(owner)) throw Error('staleContinuityOwner');
  const rows = (result: typeof records) => result.docs.map(record => ({ ...record.data(), id: record.id }) as WorkoutSession);
  const history = rows(records), now = Date.now();
  const review = reviewMesocycleClosure(source, routine.generation.goal, history, now);
  if (review.canInterrupt) previewMesocycleSuccessor(routine, source, history,
    { successorId: 'preview', reason: review.canComplete ? 'COMPLETED' : 'INTERRUPTED', microcycles: 1, now });
  return { routine, source, history, priorHistory: prior.filter(result => !result.metadata.hasPendingWrites).flatMap(rows), now };
}

export type ContinuityReviewData = Awaited<ReturnType<typeof loadContinuityReview>>;
export interface ContinuitySelection {
  reason: ClosureReason;
  microcycles: number;
  /** Retained only to recognize an exact retry of an older activation. */
  repSuggestions?: string[];
}

export async function saveMesocycleContinuation(reviewed: ContinuityReviewData, selection: ContinuitySelection,
  stillCurrent: () => boolean = () => true) {
  const owner = reviewed.routine.userId;
  const live = () => stillCurrent() && ownerIsCurrent(owner);
  if (!live()) throw Error('staleContinuityOwner');
  const sourceId = reviewed.source.id, routineId = reviewed.routine.id;
  const routineRef = doc(routines(), routineId), sourceRef = doc(blocks(), sourceId), nextRef = doc(blocks());
  const selected = [...(selection.repSuggestions ?? [])].sort();
  const expected = previewMesocycleSuccessor(reviewed.routine, reviewed.source, reviewed.history,
    { ...selection, successorId: nextRef.id, now: reviewed.now });
  return runTransaction(db, async transaction => {
    if (!live()) throw Error('staleContinuityOwner');
    const sourceDoc = await transaction.get(sourceRef);
    const routineDoc = await transaction.get(routineRef);
    const source = { ...sourceDoc.data(), id: sourceId } as Mesocycle;
    const routine = { ...routineDoc.data(), id: routineId } as Routine;
    if (!live() || !sourceDoc.exists() || !routineDoc.exists() || source.userId !== owner || routine.userId !== owner
      || source.routineId !== routineId || routine.hybrid || !routine.isActive) throw Error('staleContinuity');
    const receipt = source.continuation;
    if (receipt) {
      if (routine.activeMesocycleId !== receipt.successorId || source.status !== selection.reason
        || receipt.microcycles !== selection.microcycles || JSON.stringify(receipt.repSuggestions) !== JSON.stringify(selected)) throw Error('staleContinuity');
      return receipt.successorId;
    }
    if (selected.length) throw Error('staleContinuity');
    if (signature(source) !== signature(reviewed.source) || routine.activeMesocycleId !== sourceId
      || routine.generation.goal !== reviewed.routine.generation.goal) throw Error('staleContinuity');

    // The RN transaction API reads documents, not queries. Read the fresh owner
    // query, then lock its known documents into the transaction before writing.
    const records = await sourceHistory(owner, sourceId);
    if (records.metadata.hasPendingWrites) throw Error('continuityPendingWrites');
    const current = await Promise.all(records.docs.map(async record => {
      const snapshot = await transaction.get(record.ref);
      if (!snapshot.exists()) throw Error('staleContinuity');
      return { ...snapshot.data(), id: snapshot.id } as WorkoutSession;
    }));
    if (!live()) throw Error('staleContinuityOwner');
    if (signature(reviewedRecords(current)) !== signature(reviewedRecords(reviewed.history))) throw Error('staleContinuity');
    const now = Date.now();
    const currentReview = reviewMesocycleClosure(source, routine.generation.goal, current, now);
    if (JSON.stringify(currentReview) !== JSON.stringify(expected.review)) throw Error('staleContinuity');
    const proposal = previewMesocycleSuccessor(routine, source, current, { ...selection, successorId: nextRef.id, now });
    const { id, ...successor } = proposal.successor;
    if (signature(successor.plannedSessions) !== signature(expected.successor.plannedSessions)) throw Error('staleContinuity');

    transaction.set(nextRef, firestoreData(successor));
    transaction.update(sourceRef, { ...proposal.sourcePatch, continuation: { successorId: id, microcycles: selection.microcycles, repSuggestions: [] } });
    transaction.update(routineRef, proposal.routinePatch);
    return id;
  });
}
