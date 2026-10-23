import { SetType, type WorkoutSession } from '@/models';
import { WorkoutHealthExport, healthWorkout, readHealthJournal, type HealthBridge, type HealthEntry, type HealthWorkout } from '../workoutExport';

const session = (owner = 'owner'): WorkoutSession => ({
  id: 'session', userId: owner, mesocycleId: 'meso', microcycleId: 'micro', microcycleIndex: 0,
  performedAt: 1000, completedAt: 5000, exercises: [{ id: 'ex', exerciseId: 'ex', order: 0, isSwap: false,
    sets: [{ id: 'set', setType: SetType.NORMAL, targetReps: 10, targetWeight: 20, targetRIR: 2,
      actualReps: 10, actualWeight: 20, completionState: 'DONE', isAutoFilled: false }] }],
});
function setup(initial: string | null = null) {
  let text = initial;
  const storage = { read: jest.fn(async () => text), write: jest.fn(async (value: string) => { text = value; }) };
  const bridge: jest.Mocked<HealthBridge> = {
    authorization: jest.fn(async () => 'authorized'), authorize: jest.fn(async () => 'authorized'),
    saveWorkout: jest.fn(async (_workout: HealthWorkout): Promise<void> => undefined), deleteWorkout: jest.fn(async (_workout: HealthWorkout): Promise<void> => undefined),
  };
  const service = new WorkoutHealthExport(storage, bridge, () => 10000);
  const enable = async (owner = 'owner') => { await service.activate(owner); await service.setEnabled(owner, true); };
  const entries = () => Object.values(service.getSnapshot().entries);
  return { storage, bridge, service, enable, entries, text: () => text };
}
const queued = (action: 'save' | 'delete' = 'save', enabled = true) => JSON.stringify({ version: 1, owners: { owner: { enabled, entries: {
  '["owner","session",5000]': { ...healthWorkout(session(), 'owner', 10000), sessionId: 'session', status: 'queued', action },
} } } });

describe('completed-workout payload', () => {
  it('uses actual times, stable event identity, and no invented health quantities', () => {
    expect(healthWorkout(session(), 'owner', 10000)).toEqual({ identity: '["owner","session",5000]', startMs: 1000, endMs: 5000 });
    const stamped = { ...session(), performedAt: { seconds: 1, nanoseconds: 0 }, completedAt: { seconds: 5, nanoseconds: 0 } };
    expect(healthWorkout(stamped, 'owner', 10000)).toEqual(healthWorkout(session(), 'owner', 10000));
    expect(healthWorkout(session('different'), 'different', 10000)?.identity).not.toBe(healthWorkout(session(), 'owner', 10000)?.identity);
  });
  it.each([undefined, null, NaN, Infinity, -1, 0, 999, 1000, 10001,
    { seconds: 5 }, { seconds: 5, nanoseconds: -1 }, { seconds: 5, nanoseconds: 1e9 }, '5000'])('rejects malformed/uncompleted/future end %p', (completedAt) => {
    expect(healthWorkout({ ...session(), completedAt } as any, 'owner', 10000)).toBeNull();
  });
  it('rejects invalid owners, identities, starts and absent lists', () => {
    for (const changed of [{ discardedAt: 1 }, { userId: 'other' }, { id: '' }, { id: 1 }, { performedAt: null }, { performedAt: NaN }, { exercises: null }, { exercises: [] }]) {
      expect(healthWorkout({ ...session(), ...changed } as any, 'owner', 10000)).toBeNull();
    }
    expect(healthWorkout(null as any, 'owner')).toBeNull();
    expect(healthWorkout(session(), '', 10000)).toBeNull();
    expect(healthWorkout(session(), 'owner', NaN)).toBeNull();
  });
  it('requires completed working actuals, accepts explicit zero load and custom timed work', () => {
    const current = session(); const set = current.exercises[0].sets[0];
    for (const changes of [{ setType: SetType.WARMUP }, { completionState: 'PENDING' }, { actualReps: 0 }, { actualReps: 1.5 }, { actualWeight: NaN }, { actualWeight: -1 }, { actualWeight: undefined }]) {
      expect(healthWorkout({ ...current, exercises: [{ ...current.exercises[0], sets: [{ ...set, ...changes } as any] }] }, 'owner', 10000)).toBeNull();
    }
    expect(healthWorkout({ ...current, exercises: [{ ...current.exercises[0], sets: [{ ...set, actualWeight: 0 }] }] }, 'owner', 10000)).not.toBeNull();
    expect(healthWorkout({ ...current, exercises: [{ ...current.exercises[0], sets: [{ ...set, recording: { measure: 'SECONDS', load: 'NONE' }, actualDurationSeconds: 30 }] }] }, 'owner', 10000)).not.toBeNull();
    expect(healthWorkout({ ...current, exercises: [null, { ...current.exercises[0], sets: [null] }] } as any, 'owner', 10000)).toBeNull();
  });
});

describe('local consent and outbox', () => {
  it('defaults off and never requests permission at activation/export without opt-in', async () => {
    const h = setup(); const listener = jest.fn(); const unsubscribe = h.service.subscribe(listener);
    expect(await h.service.export(session())).toBe(false); expect(await h.service.setEnabled('owner', true)).toBe(false);
    await h.service.activate('owner');
    expect(h.service.getSnapshot()).toMatchObject({ ready: true, enabled: false, available: true });
    expect(await h.service.export(session())).toBe(false); expect(h.bridge.authorize).not.toHaveBeenCalled();
    expect(listener).toHaveBeenCalled(); unsubscribe();
    await h.service.activate(null); expect(h.service.getSnapshot().entries).toEqual({});
    expect(h.bridge.saveWorkout).not.toHaveBeenCalled();
  });
  it('saves consent and durable intent before native save, never exports history automatically, and deduplicates retries', async () => {
    const h = setup(); await h.enable();
    expect(h.bridge.saveWorkout).not.toHaveBeenCalled();
    h.bridge.saveWorkout.mockImplementation(async () => { expect(JSON.parse(h.text()!).owners.owner.entries['["owner","session",5000]'].status).toBe('queued'); });
    expect(await h.service.export(session())).toBe(true); expect(await h.service.export(session())).toBe(true);
    expect(h.entries()[0].status).toBe('saved'); expect(h.bridge.saveWorkout).toHaveBeenCalledTimes(1);
    const invalid = { ...session(), completedAt: undefined }; expect(await h.service.export(invalid)).toBe(false);
  });
  it('keeps permission denial and unavailable platforms off', async () => {
    const h = setup(); h.bridge.authorization.mockResolvedValue('unavailable'); await h.service.activate('owner');
    expect(h.service.getSnapshot().available).toBe(false);
    h.bridge.authorize.mockResolvedValue('denied'); expect(await h.service.setEnabled('owner', true)).toBe(false);
    expect(h.service.getSnapshot()).toMatchObject({ enabled: false, error: true });
    expect(await h.service.setEnabled('other', true)).toBe(false);
  });
  it('surfaces revoked permission and native failure without losing Vigor data; manual retry succeeds', async () => {
    const h = setup(); await h.enable(); h.bridge.authorization.mockResolvedValueOnce('denied');
    expect(await h.service.export(session())).toBe(false); expect(h.entries()[0].status).toBe('denied');
    h.bridge.saveWorkout.mockRejectedValueOnce(Error('locked'));
    expect(await h.service.export(session())).toBe(false); expect(h.entries()[0].status).toBe('failed');
    expect(await h.service.export(session())).toBe(true); expect(h.entries()[0].status).toBe('saved');
  });
  it('records unavailable exports and authorization exceptions safely', async () => {
    const h = setup(); await h.enable(); h.bridge.authorization.mockResolvedValueOnce('unavailable');
    expect(await h.service.export(session())).toBe(false); expect(h.entries()[0].status).toBe('failed');
    h.bridge.authorization.mockRejectedValueOnce(Error('bridge')); expect(await h.service.export(session())).toBe(false);
    h.bridge.authorize.mockRejectedValueOnce(Error('OS')); expect(await h.service.setEnabled('owner', true)).toBe(false);
  });
  it('recovers durable queued saves after a crash without re-prompting', async () => {
    const h = setup(queued()); await h.service.activate('owner');
    expect(h.bridge.saveWorkout).toHaveBeenCalledTimes(1); expect(h.bridge.authorize).not.toHaveBeenCalled();
    expect(h.entries()[0].status).toBe('saved'); await h.service.retryPending('owner'); expect(h.bridge.saveWorkout).toHaveBeenCalledTimes(1);
  });
  it('does not drain disabled saves; disabling cancels a queued save but retains saved entries', async () => {
    const h = setup(queued('save', false)); await h.service.activate('owner'); expect(h.bridge.saveWorkout).not.toHaveBeenCalled();
    expect(await h.service.setEnabled('owner', false)).toBe(true); expect(h.entries()[0].status).toBe('kept');
    await h.service.setEnabled('owner', true); await h.service.export(session()); await h.service.setEnabled('owner', false);
    expect(h.entries()[0].status).toBe('saved'); expect(h.bridge.deleteWorkout).not.toHaveBeenCalled();
  });
  it('never overwrites corrupt journal data and allows storage recovery', async () => {
    const h = setup('{bad'); await h.service.activate('owner');
    expect(h.service.getSnapshot()).toMatchObject({ error: true, ready: false });
    expect(await h.service.export(session())).toBe(false); expect(await h.service.setEnabled('owner', true)).toBe(false);
    expect(h.storage.write).not.toHaveBeenCalled();
    h.storage.read.mockResolvedValue(null); await h.service.activate('owner'); expect(h.service.getSnapshot().ready).toBe(true);
  });
  it('does not call Health if intent storage fails, and safely retries after an acknowledgment storage failure', async () => {
    const h = setup(); await h.enable();
    h.storage.write.mockRejectedValueOnce(Error('disk full')); expect(await h.service.export(session())).toBe(false);
    expect(h.bridge.saveWorkout).not.toHaveBeenCalled();
    h.bridge.saveWorkout.mockImplementationOnce(async () => { h.storage.write.mockRejectedValueOnce(Error('disk full')); });
    expect(await h.service.export(session())).toBe(false); expect(h.entries()[0].status).toBe('queued');
    await h.service.retryPending('owner'); expect(h.entries()[0].status).toBe('saved');
    expect(h.bridge.saveWorkout.mock.calls[0][0].identity).toBe(h.bridge.saveWorkout.mock.calls[1][0].identity);
  });
  it('guards consent storage failure', async () => {
    const h = setup(); await h.service.activate('owner'); h.storage.write.mockRejectedValueOnce(Error('disk'));
    expect(await h.service.setEnabled('owner', true)).toBe(false); expect(h.service.getSnapshot().enabled).toBe(false);
  });
  it('hides another owner immediately and never drains their entries', async () => {
    const h = setup(queued()); const first = h.service.activate('owner'); const second = h.service.activate('other');
    expect(h.service.getSnapshot().entries).toEqual({}); await Promise.all([first, second]);
    expect(h.bridge.saveWorkout).not.toHaveBeenCalled(); expect(h.service.getSnapshot().owner).toBe('other');
    expect(await h.service.export(session())).toBe(false);
    await h.service.activate('owner'); expect(h.entries()[0].status).toBe('saved');
  });
  it('stops a permission prompt or authorization check when the owner changes', async () => {
    const h = setup(); await h.service.activate('owner');
    let resolve!: (value: 'authorized') => void;
    h.bridge.authorize.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const enabling = h.service.setEnabled('owner', true); await Promise.resolve(); await Promise.resolve();
    const changed = h.service.activate('other'); resolve('authorized'); expect(await enabling).toBe(false); await changed;
    expect(h.service.getSnapshot().enabled).toBe(false);
  });
  it('handles account identifiers that match prototype property names', async () => {
    const h = setup(); await h.enable('__proto__'); expect(await h.service.export(session('__proto__'))).toBe(true);
    expect(h.entries()[0].status).toBe('saved'); expect(readHealthJournal(h.text()!).owners.__proto__.enabled).toBe(true);
  });
  it('cancels activation results after an owner switch during OS authorization', async () => {
    const h = setup(); let resolve!: (value: 'authorized') => void;
    h.bridge.authorization.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const old = h.service.activate('owner'); for (let i = 0; i < 5; i++) await Promise.resolve();
    const next = h.service.activate('other'); resolve('authorized'); await Promise.all([old, next]);
    expect(h.service.getSnapshot()).toMatchObject({ owner: 'other', ready: true, error: false });
  });
  it('does not publish old-owner storage failures over a new owner', async () => {
    const h = setup(); let reject!: (reason: Error) => void;
    h.storage.read.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
    const old = h.service.activate('owner'); for (let i = 0; i < 5; i++) await Promise.resolve();
    const next = h.service.activate('other'); reject(Error('old file')); await Promise.all([old, next]);
    expect(h.service.getSnapshot()).toMatchObject({ owner: 'other', ready: true, error: false });
  });
  it('does not start a native export after the owner changes during intent persistence', async () => {
    const h = setup(); await h.enable();
    h.storage.write.mockImplementationOnce(async () => { void h.service.activate('other'); });
    expect(await h.service.export(session())).toBe(false); expect(h.bridge.saveWorkout).not.toHaveBeenCalled();
    await h.service.activate('other');
  });
  it('does not start a native export after the owner changes during permission checking', async () => {
    const h = setup(); await h.enable(); let resolve!: (value: 'authorized') => void;
    h.bridge.authorization.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const exporting = h.service.export(session()); for (let i = 0; i < 12; i++) await Promise.resolve();
    const switched = h.service.activate('other'); resolve('authorized'); expect(await exporting).toBe(false); await switched;
    expect(h.bridge.saveWorkout).not.toHaveBeenCalled();
  });
  it('keeps an already accepted native result private after an owner switch', async () => {
    const h = setup(); await h.enable();
    h.bridge.saveWorkout.mockImplementationOnce(async () => { void h.service.activate('other'); });
    expect(await h.service.export(session())).toBe(true); await h.service.activate('other');
    expect(h.entries()).toEqual([]); await h.service.activate('owner'); expect(h.entries()[0].status).toBe('saved');
  });
  it('does not drain a stale owner and never lets a rejected operation poison the queue', async () => {
    const h = setup(queued()); await h.service.activate('other'); await h.service.retryPending('owner');
    expect(h.bridge.saveWorkout).not.toHaveBeenCalled();
    await expect((h.service as any).run(async () => { throw Error('operation'); })).rejects.toThrow('operation');
    await h.service.activate('other'); expect(h.service.getSnapshot().ready).toBe(true);
  });
  it('guards the internal unloaded-storage invariant and supports the default real clock', async () => {
    const h = setup(); await expect((h.service as any).persist('owner', { enabled: true, entries: {} })).rejects.toThrow('not loaded');
    const realClock = new WorkoutHealthExport(h.storage, h.bridge); await realClock.activate('owner');
    expect(realClock.getSnapshot().ready).toBe(true);
  });
});

describe('explicit deletion semantics', () => {
  it('deletes only Vigor when requested, preserving Health and cancelling a queued save', async () => {
    const h = setup(queued('save', false)); await h.service.activate('owner'); const remove = jest.fn(async () => undefined);
    expect(await h.service.remove(session(), false, remove)).toBe(true); expect(h.entries()[0].status).toBe('kept');
    expect(remove).toHaveBeenCalled(); expect(h.bridge.deleteWorkout).not.toHaveBeenCalled();
    await h.service.retryPending('owner'); expect(h.bridge.saveWorkout).not.toHaveBeenCalled();
  });
  it('deletes only the matching exported identity before deleting Vigor, including while export is disabled', async () => {
    const h = setup(); await h.enable(); await h.service.export(session()); await h.service.setEnabled('owner', false);
    const remove = jest.fn(async () => { expect(h.entries()[0].status).toBe('deleted'); });
    expect(await h.service.remove(session(), true, remove)).toBe(true);
    expect(h.bridge.deleteWorkout.mock.calls[0][0].identity).toBe(h.bridge.saveWorkout.mock.calls[0][0].identity);
    expect(remove).toHaveBeenCalled();
  });
  it('keeps Vigor history on Health failure and allows an explicit retry', async () => {
    const h = setup(); await h.enable(); const remove = jest.fn(async () => undefined);
    h.bridge.deleteWorkout.mockRejectedValueOnce(Error('locked'));
    expect(await h.service.remove(session(), true, remove)).toBe(false); expect(remove).not.toHaveBeenCalled();
    expect(h.entries()[0]).toMatchObject({ action: 'delete', status: 'failed' });
    expect(await h.service.remove(session(), true, remove)).toBe(true); expect(remove).toHaveBeenCalledTimes(1);
  });
  it('recovers queued deletions while disabled and preserves retry if Vigor deletion fails', async () => {
    const h = setup(queued('delete', false)); await h.service.activate('owner');
    expect(h.bridge.deleteWorkout).toHaveBeenCalledTimes(1); expect(h.entries()[0].status).toBe('deleted');
    expect(await h.service.remove(session(), true, async () => { throw Error('Firestore'); })).toBe(false);
    expect(h.entries()[0].status).toBe('deleted');
  });
  it('guards missing owners, foreign records and invalid delete-both payloads, while allowing plain draft deletion', async () => {
    const h = setup(); const remove = jest.fn(async () => undefined);
    expect(await h.service.remove(session(), false, remove)).toBe(false); await h.service.activate('owner');
    expect(await h.service.remove(session('other'), false, remove)).toBe(false);
    expect(await h.service.remove({ ...session(), completedAt: undefined }, true, remove)).toBe(false);
    expect(await h.service.remove({ ...session(), completedAt: undefined }, false, remove)).toBe(true);
    expect(remove).toHaveBeenCalledTimes(1);
  });
  it('creates a deletion intention without requiring future-export opt-in', async () => {
    const h = setup(); await h.service.activate('owner'); const remove = jest.fn(async () => undefined);
    expect(await h.service.remove(session(), true, remove)).toBe(true); expect(h.entries()[0].status).toBe('deleted');
    expect(h.service.getSnapshot().enabled).toBe(false);
  });
  it('does not delete Vigor after the owner changes during a native deletion', async () => {
    const h = setup(); await h.enable(); const remove = jest.fn(async () => undefined);
    h.bridge.deleteWorkout.mockImplementationOnce(async () => { void h.service.activate('other'); });
    expect(await h.service.remove(session(), true, remove)).toBe(false); await h.service.activate('other');
    expect(remove).not.toHaveBeenCalled();
  });
});

describe('journal validation', () => {
  it.each(['null', '{}', '{"version":2,"owners":{}}', '{"version":1,"owners":[]}',
    '{"version":1,"owners":{"owner":null}}', '{"version":1,"owners":{"owner":{"enabled":0,"entries":{}}}}',
    '{"version":1,"owners":{"owner":{"enabled":true,"entries":[]}}}'])('rejects unsafe storage %s', (raw) => {
    expect(() => readHealthJournal(raw)).toThrow();
  });
  it('validates identity ownership, numeric bounds and status/action enums', () => {
    const mutations: Partial<HealthEntry>[] = [{ identity: 'foreign' }, { sessionId: '' }, { startMs: 0 }, { endMs: -1 },
      { startMs: NaN }, { status: 'unknown' as any }, { action: 'broad-delete' as any }];
    for (const mutation of mutations) {
      const document = JSON.parse(queued()); Object.assign(document.owners.owner.entries['["owner","session",5000]'], mutation);
      expect(() => readHealthJournal(JSON.stringify(document))).toThrow();
    }
  });
});
