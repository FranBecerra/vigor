import { WorkoutWriteGate } from '../workoutWriteGate';
it('waits for all accepted writes, blocks new ones and stays stopped after discard', async () => {
  const gate = new WorkoutWriteGate(); const calls: string[] = []; let resolve!: () => void;
  const pending = gate.write(() => new Promise<void>((done) => { resolve = done; calls.push('write'); }));
  await Promise.resolve(); const discard = gate.discard(async () => { calls.push('discard'); });
  expect(gate.stopped).toBe(true); expect(await gate.write(async () => calls.push('forbidden'))).toBeNull();
  expect(await gate.discard(async () => { calls.push('duplicate'); })).toBe(false); resolve();
  expect(await discard).toBe(true); await pending; expect(calls).toEqual(['write', 'discard']);
  expect(await gate.write(async () => 'unmount')).toBeNull();
});
it('tolerates a rejected pending save and re-enables saving if discard fails', async () => {
  const gate = new WorkoutWriteGate(); const pending = gate.write(async () => { throw Error('save'); });
  const assertion = expect(pending).rejects.toThrow('save');
  expect(await gate.discard(async () => { throw Error('discard'); })).toBe(false); await assertion;
  expect(gate.stopped).toBe(false); expect(await gate.write(async () => 3)).toBe(3);
  expect(await gate.discard(async () => undefined)).toBe(true);
});
