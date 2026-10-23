import { SetType, type WorkoutSession } from '@/models';
import { isSetCompleted } from '@/services/training/sessionMapper';

export type HealthAuthorization = 'authorized' | 'denied' | 'notDetermined' | 'unavailable';
export type HealthExportStatus = 'queued' | 'saved' | 'denied' | 'failed' | 'deleted' | 'kept';
export interface HealthWorkout { identity: string; startMs: number; endMs: number }
export interface HealthEntry extends HealthWorkout { sessionId: string; status: HealthExportStatus; action: 'save' | 'delete' }
interface OwnerData { enabled: boolean; entries: Record<string, HealthEntry> }
export interface HealthJournal { version: 1; owners: Record<string, OwnerData> }
export interface HealthBridge {
  authorization(): Promise<HealthAuthorization>;
  authorize(): Promise<HealthAuthorization>;
  saveWorkout(workout: HealthWorkout): Promise<void>;
  deleteWorkout(workout: HealthWorkout): Promise<void>;
}
export interface HealthStorage { read(): Promise<string | null>; write(value: string): Promise<void> }
export interface HealthExportView { owner: string | null; ready: boolean; enabled: boolean; available: boolean; error: boolean; entries: Record<string, HealthEntry> }

function milliseconds(value: unknown): number {
  if (typeof value === 'number') return value;
  if (!value || typeof value !== 'object') return NaN;
  const { seconds, nanoseconds } = value as { seconds?: unknown; nanoseconds?: unknown };
  return typeof seconds === 'number' && typeof nanoseconds === 'number' && nanoseconds >= 0 && nanoseconds < 1e9
    ? seconds * 1000 + nanoseconds / 1e6 : NaN;
}

/** Export actual elapsed time only. Never derive energy, HR or duration from dose. */
export function healthWorkout(session: WorkoutSession, owner: string, now = Date.now()): HealthWorkout | null {
  if (!session || session.discardedAt !== undefined || !Array.isArray(session.exercises)) return null;
  const startMs = milliseconds(session.performedAt); const endMs = milliseconds(session.completedAt);
  if (!owner || session.userId !== owner || typeof session.id !== 'string' || !session.id.trim() || !Number.isFinite(now)
    || !Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs <= 0 || endMs <= startMs || endMs > now) return null;
  const completed = session.exercises.some((exercise) => Array.isArray(exercise?.sets) && exercise.sets.some((set) => {
    if (!set || set.setType === SetType.WARMUP || !isSetCompleted(set)) return false;
    if (set.recording) return true; // Custom recording has strict validation in isSetCompleted.
    return Number.isFinite(set.actualWeight) && set.actualWeight! >= 0 && Number.isInteger(set.actualReps) && set.actualReps! > 0;
  }));
  if (!completed) return null;
  return { identity: JSON.stringify([owner, session.id, endMs]), startMs, endMs };
}

/** Fail closed on a corrupt journal instead of silently losing consent or links. */
export function readHealthJournal(text: string | null): HealthJournal {
  if (text === null) return { version: 1, owners: {} };
  const data = JSON.parse(text) as HealthJournal;
  if (data?.version !== 1 || !data.owners || typeof data.owners !== 'object' || Array.isArray(data.owners)) throw Error('Invalid health journal');
  for (const [owner, value] of Object.entries(data.owners)) {
    if (!owner || !value || typeof value.enabled !== 'boolean' || !value.entries || typeof value.entries !== 'object' || Array.isArray(value.entries)) throw Error('Invalid health owner');
    for (const [key, entry] of Object.entries(value.entries)) {
      if (!entry || key !== entry.identity || entry.identity !== JSON.stringify([owner, entry.sessionId, entry.endMs])
        || typeof entry.sessionId !== 'string' || !entry.sessionId || !Number.isFinite(entry.startMs) || !Number.isFinite(entry.endMs) || entry.startMs <= 0 || entry.endMs <= entry.startMs
        || !['queued', 'saved', 'denied', 'failed', 'deleted', 'kept'].includes(entry.status)
        || !['save', 'delete'].includes(entry.action)) throw Error('Invalid health entry');
    }
  }
  return data;
}

/** Serialized, device-local outbox. No Firestore health permission/status fields. */
export class WorkoutHealthExport {
  private document: HealthJournal | null = null;
  private owner: string | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private listeners = new Set<() => void>();
  private view: HealthExportView = { owner: null, ready: false, enabled: false, available: false, error: false, entries: {} };
  constructor(private storage: HealthStorage, private bridge: HealthBridge, private now = Date.now) {}
  private ownerData(owner: string) { return this.document && Object.hasOwn(this.document.owners, owner) ? this.document.owners[owner] : undefined; }
  getSnapshot = () => this.view;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<HealthExportView> = {}) {
    const value = this.owner ? this.ownerData(this.owner) : undefined;
    this.view = { ...this.view, owner: this.owner, enabled: value?.enabled ?? false, entries: value?.entries ?? {}, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  private run<T>(action: () => Promise<T>): Promise<T> {
    const next = this.queue.catch(() => undefined).then(action); this.queue = next; return next;
  }
  private async persist(owner: string, value: OwnerData) {
    if (!this.document) throw Error('Health journal not loaded');
    const next: HealthJournal = { version: 1, owners: Object.fromEntries([...Object.entries(this.document.owners), [owner, value]]) };
    await this.storage.write(JSON.stringify(next)); this.document = next; this.publish();
  }
  private async entry(owner: string, entry: HealthEntry) {
    const current = this.ownerData(owner) ?? { enabled: false, entries: {} };
    await this.persist(owner, { ...current, entries: { ...current.entries, [entry.identity]: entry } });
  }
  activate(owner: string | null): Promise<void> {
    this.owner = owner; this.publish({ ready: false, error: false }); // Hide old-owner state immediately.
    return this.run(async () => {
      if (this.owner !== owner) return;
      try {
        if (!this.document) this.document = readHealthJournal(await this.storage.read());
        const available = owner !== null && await this.bridge.authorization() !== 'unavailable';
        if (this.owner !== owner) return;
        this.publish({ ready: true, available });
        if (owner) await this.drain(owner);
      } catch { if (this.owner === owner) this.publish({ ready: false, error: true }); }
    });
  }
  setEnabled(owner: string, enabled: boolean): Promise<boolean> {
    return this.run(async () => {
      if (!this.document || !this.view.ready || this.owner !== owner) return false;
      try {
        if (enabled && await this.bridge.authorize() !== 'authorized') { this.publish({ error: true }); return false; }
        if (this.owner !== owner) return false;
        const current = this.ownerData(owner) ?? { enabled: false, entries: {} };
        // Turning off stops pending saves too; it never deletes previously exported workouts.
        const entries = Object.fromEntries(Object.entries(current.entries).map(([key, value]) => [key,
          !enabled && value.action === 'save' && value.status === 'queued' ? { ...value, status: 'kept' as const } : value]));
        await this.persist(owner, { enabled, entries }); this.publish({ error: false }); return true;
      } catch { this.publish({ error: true }); return false; }
    });
  }
  export(session: WorkoutSession): Promise<boolean> {
    const owner = this.owner;
    return this.run(async () => {
      if (!owner || !this.view.ready || this.owner !== owner || !this.ownerData(owner)?.enabled) return false;
      const payload = healthWorkout(session, owner, this.now());
      if (!payload) return false;
      const previous = this.ownerData(owner)!.entries[payload.identity];
      if (previous?.status === 'saved') return true;
      try {
        const entry: HealthEntry = { ...payload, sessionId: session.id, action: 'save', status: 'queued' };
        await this.entry(owner, entry); return await this.perform(owner, entry);
      } catch { this.publish({ error: true }); return false; }
    });
  }
  /** Explicit delete choice; native failure leaves the Vigor record available to retry. */
  remove(session: WorkoutSession, alsoHealth: boolean, deleteVigor: () => Promise<void>): Promise<boolean> {
    const owner = this.owner;
    return this.run(async () => {
      if (!owner || !this.view.ready || this.owner !== owner || session.userId !== owner || !this.document) return false;
      const payload = healthWorkout(session, owner, this.now());
      const previous = payload ? this.ownerData(owner)?.entries[payload.identity] : undefined;
      try {
        if (alsoHealth) {
          if (!payload) return false;
          const entry: HealthEntry = { ...payload, sessionId: session.id, action: 'delete', status: 'queued' };
          await this.entry(owner, entry);
          if (!await this.perform(owner, entry)) return false;
        } else if (previous) await this.entry(owner, { ...previous, status: 'kept' });
        if (this.owner !== owner) return false;
        await deleteVigor(); this.publish({ error: false }); return true;
      } catch { this.publish({ error: true }); return false; }
    });
  }
  retryPending(owner: string): Promise<void> { return this.run(() => this.drain(owner)); }
  private async drain(owner: string) {
    for (const entry of Object.values(this.ownerData(owner)?.entries ?? {})) {
      if (this.owner !== owner) return;
      if (entry.status === 'queued' && (entry.action === 'delete' || this.ownerData(owner)?.enabled)) await this.perform(owner, entry);
    }
  }
  private async perform(owner: string, entry: HealthEntry): Promise<boolean> {
    if (this.owner !== owner) return false;
    let status: HealthExportStatus;
    try {
      const auth = await this.bridge.authorization();
      if (this.owner !== owner) return false;
      if (auth !== 'authorized') status = auth === 'unavailable' ? 'failed' : 'denied';
      else {
        if (entry.action === 'save') await this.bridge.saveWorkout(entry); else await this.bridge.deleteWorkout(entry);
        status = entry.action === 'save' ? 'saved' : 'deleted';
      }
    } catch { status = 'failed'; }
    await this.entry(owner, { ...entry, status });
    if (this.owner === owner) this.publish({ error: false });
    return status === 'saved' || status === 'deleted';
  }
}
