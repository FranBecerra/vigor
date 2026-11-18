import { routineRestDays } from '@/services/training/routineRestDays';
import { agendaMove, agendaMoveTo, pendingAgendaSession, trainingAgenda, type AgendaMove } from '../trainingAgenda';
import { cardioHomeFixture } from '@/test-support/cardioHomeFixture';
import { cardioFixture, weeklyCardioAgendaFixture } from '@/test-support/cardioFixture';
import { cardioHomeSessions } from '@/services/cardio/cardioHome';
import { changeCardioSlot, createCardioBlock } from '@/services/cardio/cardioBlock';
import { startCardioWorkout, transitionCardioWorkout } from '@/services/cardio/cardioWorkout';
import { saveSportDraft } from '@/services/cardio/sportActivities';
import { createLinkedCardioWorkout } from '@/services/cardio/cardioHealthLink';

const now = Date.UTC(2026, 9, 29, 18), owner = 'owner', today = '2026-10-29';

it('interleaves linked positions with the strength rhythm and leaves the same next session after a missed day', () => {
  const { routine, block } = cardioHomeFixture(owner, now);
  const first = trainingAgenda(owner, [routine], [block], [], [], today);
  const later = trainingAgenda(owner, [routine], [block], [], [], '2026-11-08');
  expect(first.rows.map(e => e.kind)).toEqual(expect.arrayContaining(['strength', 'cardio', 'rest']));
  expect(first.rows.filter(e => e.kind !== 'rest').every(e => e.date === undefined)).toBe(true);
  expect(later).toEqual(first);
  const earliest = first.rows.find(e => e.kind === 'cardio');
  expect(earliest).toBeDefined();
  expect(trainingAgenda('foreign', [routine], [block], [], [], today)).toEqual({ rows: [], nextId: undefined, restScope: undefined });
});

it('keeps standalone undated strength and legacy plans in their existing relative order', () => {
  const { routine } = cardioHomeFixture(owner, now);
  const meso = routine.mesocycleSnapshot!;
  const malformed = { ...routine, mesocycleSnapshot: { ...meso, restDays: [{ id: 'invalid', afterSessionIndex: 99 }] } };
  const agenda = trainingAgenda(owner, [malformed], [], [], []);
  expect(agenda.rows.filter(e => e.kind === 'strength').map(e => e.session.id)).toEqual(routine.microcycles[0].sessions.map(s => s.id));
  expect(agenda.nextId).toBe(agenda.rows[0].id);
});

it('moves before or after an adjacent item, preserving fixed activities and recorded dates', () => {
  const { routine, block } = cardioHomeFixture(owner, now);
  const sport = saveSportDraft('padel', owner, { sport: 'PADEL', context: 'CLASS', name: 'Pádel', notes: '', mode: 'PLAN',
    startAt: now + 86400000, durationMinutes: 60, timeZone: 'Europe/Madrid', effort: null }, now);
  const base = trainingAgenda(owner, [routine], [block], [], [sport], today);
  const firstCardio = base.rows.find(row => row.kind === 'cardio')!;
  const change = agendaMove(base.rows, firstCardio.id, 1)!;
  const moved = trainingAgenda(owner, [routine], [block], [], [sport], today, [change]);
  expect(moved.rows.findIndex(r => r.id === firstCardio.id)).toBeGreaterThan(moved.rows.findIndex(r => r.id === change.anchor));
  expect(moved.rows.find(r => r.kind === 'sport')).toMatchObject({ date: '2026-10-30' });
  expect(agendaMove(base.rows, 'sport:padel', -1)).toBeNull();
  expect(trainingAgenda(owner, [routine], [block], [], [sport], today, [{ ...change, anchor: 'gone' }])).toEqual(base);
});

it('advances only after resolving a session and retains real dates of completed cardio', () => {
  const block = cardioFixture({}, now), before = trainingAgenda(owner, [], [block], [], [], today);
  const first = before.rows[0];
  if (first.kind !== 'cardio') throw Error('Expected cardio');
  const finished = transitionCardioWorkout(startCardioWorkout(block, first.session.slot.id, now, 'done'), 'FINISH', now + 60000, 60);
  const after = trainingAgenda(owner, [], [block], [finished], [], today);
  expect(after.rows[0]).toMatchObject({ id: first.id, date: today });
  expect(after.nextId).toBe(before.rows[1].id);
  const skipped = changeCardioSlot(block, first.session.slot.id, first.session.slot.date, 'SKIPPED', null, [], now + 1);
  expect(trainingAgenda(owner, [], [skipped], [], [], today).nextId).toBe(before.rows[1].id);
});

it('retains late Health results in the block history without mixing cardio cycles in the agenda', () => {
  const block = cardioFixture({}, now), linkedAt = now + 20 * 86400000;
  const slots = block.slots.filter(s => s.cycle === 0);
  const finish = startCardioWorkout(block, slots[0].id, now, 'timer');
  const actual = createLinkedCardioWorkout(block, slots[1].id, 'watch', { version: 1, truncated: false, workouts: [{
    id: 'watch', kind: 'RUNNING', start: linkedAt - 3600000, end: linkedAt - 1800000, durationSeconds: 1800, linkKey: 'a'.repeat(64),
    sourceId: 'watch', sourceName: 'Watch', manuallyEntered: false, mixedActivities: false, ownExport: false,
  }] }, [], linkedAt, 'linked');
  const agenda = trainingAgenda(owner, [], [block], [transitionCardioWorkout(finish, 'FINISH', now + 60000, 60), actual], [], '2026-11-18');
  expect(agenda.rows.filter(row => row.kind === 'cardio').map(row => row.session.slot.cycle)).toEqual([1, 1]);
  expect(cardioHomeSessions(block, [actual]).find(row => row.workout?.id === 'linked')).toMatchObject({ date: '2026-11-18' });
});

it('appends and moves added rest in its current microcycle while keeping it out of other cycles', () => {
  const { routine, block } = cardioHomeFixture(owner, now);
  const initial = trainingAgenda(owner, [routine], [block], [], [], today);
  const rest = { id: 'extra-rest', scope: initial.restScope!, checked: false };
  const withRest = trainingAgenda(owner, [routine], [block], [], [], today, [], [rest, { ...rest, id: 'different', scope: 'old-cycle' }]);
  expect(withRest.rows.at(-1)).toEqual({ ...rest, extra: true, kind: 'rest' });
  expect(withRest.rows).toHaveLength(initial.rows.length + 1);
  const next = withRest.rows.findIndex(row => row.id === withRest.nextId);
  expect(agendaMoveTo(withRest.rows, withRest.rows.length - 1, next)?.direction).toBe(-1);
  const destination = next + 1;
  const move = agendaMoveTo(withRest.rows, withRest.rows.length - 1, destination)!;
  expect(move).toEqual({ id: rest.id, anchor: initial.rows[destination].id, direction: -1 });
  const checked = trainingAgenda(owner, [routine], [block], [], [], today, [move], [{ ...rest, checked: true }]);
  expect(checked.rows[destination]).toMatchObject({ id: rest.id, checked: true });
  expect(checked.nextId).toBe(initial.nextId);
  expect(agendaMoveTo(checked.rows, destination, destination + 1)?.direction).toBe(1);
  expect(agendaMoveTo(checked.rows, 1, checked.rows.length)).toBeNull();
  expect(trainingAgenda(owner, [], [block], [], [], today, [], [rest]).rows.some(row => row.id === rest.id)).toBe(false);
});

it('keeps the historical prefix locked and lets later sessions become next by moving the current session down', () => {
  const block = cardioFixture({}, now), first = block.slots[0];
  const workout = transitionCardioWorkout(startCardioWorkout(block, first.id, now, 'done'), 'FINISH', now + 60000, 60);
  const { routine } = cardioHomeFixture(owner, now);
  const { rows, nextId } = trainingAgenda(owner, [routine], [block], [workout], [], today);
  const next = rows.findIndex(row => row.id === nextId);
  const later = rows.findIndex((row, index) => row.kind === 'cardio' && index > next && pendingAgendaSession(row));
  expect(later).toBeGreaterThan(next);
  expect(agendaMoveTo(rows, later, next)).toBeNull();
  expect(agendaMoveTo(rows, later, next - 1)).toBeNull();
  expect(agendaMove(rows, rows[next].id, -1)).toBeNull();
  expect(agendaMoveTo(rows, next, later)).toMatchObject({ id: nextId, anchor: rows[later].id, direction: 1 });
});

it('moves a checked rest back across Up next and keeps its check and the next workout', () => {
  const { routine, block } = cardioHomeFixture(owner, now);
  const base = trainingAgenda(owner, [routine], [block], [], [], today);
  const rest = { id: 'extra-rest', scope: base.restScope!, checked: true };
  const project = (moves: AgendaMove[] = []) =>
    trainingAgenda(owner, [routine], [block], [], [], today, moves, [rest]);
  const initial = project();
  const nextIndex = initial.rows.findIndex(row => row.id === initial.nextId);
  const earlier = agendaMoveTo(initial.rows, initial.rows.length - 1, nextIndex)!;
  const moved = project([earlier]);
  expect(moved.rows[nextIndex]).toMatchObject({ id: rest.id, checked: true });
  expect(moved.nextId).toBe(initial.nextId);
  const later = agendaMove(moved.rows, rest.id, 1)!;
  expect(later).toEqual({ id: rest.id, anchor: initial.nextId, direction: 1 });
  const restored = project([earlier, later]);
  expect(restored.rows[nextIndex + 1]).toMatchObject({ id: rest.id, checked: true });
  expect(restored.nextId).toBe(initial.nextId);
});

it('keeps a linked completion visible and opens the next cardio cycle only when it starts', () => {
  const block = cardioFixture({}, now);
  const [first, last] = block.slots.filter(slot => slot.cycle === 0);
  const finished = transitionCardioWorkout(startCardioWorkout(block, first.id, now, 'first'), 'FINISH', now + 60000, 60);
  const start = now - 3 * 86400000;
  const linked = createLinkedCardioWorkout(block, last.id, 'watch', { version: 1, truncated: false, workouts: [{
    id: 'watch', kind: 'RUNNING', start, end: start + 1800000, durationSeconds: 1800, linkKey: 'b'.repeat(64),
    sourceId: 'watch', sourceName: 'Watch', manuallyEntered: false, mixedActivities: false, ownExport: false,
  }] }, [finished], now + 60000, 'linked');
  const before = trainingAgenda(owner, [], [block], [finished], [], today);
  const workouts = [finished, linked];
  const after = trainingAgenda(owner, [], [block], workouts, [], today);
  expect(after.nextId).toBeUndefined();
  const nextWeek = trainingAgenda(owner, [], [block], workouts, [], '2026-11-06');
  const next = nextWeek.rows.findIndex(row => row.id === nextWeek.nextId);
  const completed = after.rows.findIndex(row => row.kind === 'cardio' && row.session.workout?.id === linked.id);
  expect(nextWeek.rows[next]).toMatchObject({ session: { slot: block.slots.find(slot => slot.cycle === 1) } });
  expect(before.rows.some(row => row.id === nextWeek.nextId)).toBe(false);
  expect(after.rows[completed]).toMatchObject({ id: before.nextId, date: '2026-10-26' });
  const previous = after.rows.findIndex(row => row.id !== before.nextId);
  const move = agendaMoveTo(after.rows, completed, previous)!;
  const reordered = trainingAgenda(owner, [], [block], workouts, [], today, [move]);
  expect(reordered.rows[previous]).toMatchObject({ id: before.nextId, date: '2026-10-26', session: { completed: true } });
});

it('keeps one-run-per-week plans from advancing twice in the same Monday-based week', () => {
  const block = cardioFixture({ cycleDays: 7, availableDays: [0, 2, 4, 6], sessions: 1 }, now);
  const late = Date.UTC(2026, 10, 4, 18);
  const [first] = block.slots;
  const completed = transitionCardioWorkout(startCardioWorkout(block, first.id, late, 'late'), 'FINISH', late + 60000, 60);
  expect(trainingAgenda(owner, [], [block], [completed], [], '2026-11-05').nextId).toBeUndefined();
  expect(trainingAgenda(owner, [], [block], [completed], [], '2026-11-09').nextId).toContain(block.slots[1].id);
  expect(trainingAgenda(owner, [], [block], [], [], '2026-11-09').nextId).toContain(first.id);
});

it('hides a deleted scheduled rest only for the selected microcycle', () => {
  const { routine } = cardioHomeFixture(owner, now);
  const initial = trainingAgenda(owner, [routine], [], [], [], today);
  const rest = initial.rows.find(row => row.kind === 'rest')!;
  const ids = [rest.id];
  expect(trainingAgenda(owner, [routine], [], [], [], today, [], [], ids).rows.some(row => row.id === rest.id)).toBe(false);
  const following = trainingAgenda(owner, [{ ...routine, currentMicrocycleIndex: 1 }], [], [], [], today, [], [], ids);
  expect(following.rows.filter(row => row.kind === 'rest')).toHaveLength(initial.rows.filter(row => row.kind === 'rest').length);
});

it('previews Monday cardio after Sunday strength rollover without making it the next workout early', () => {
  const { block, workouts } = weeklyCardioAgendaFixture();
  const [, second] = block.slots;
  const { routine } = cardioHomeFixture(owner, now);
  const agenda = (day: string, strength = [routine]) => trainingAgenda(owner, strength, [block], workouts, [], day);
  expect(agenda('2026-11-14').rows.filter(row => row.kind === 'cardio')).toMatchObject([{ session: { completed: true } }]);
  const preview = agenda('2026-11-15');
  const runs = preview.rows.filter(row => row.kind === 'cardio');
  expect(runs).toMatchObject([{ upcoming: true, date: '2026-11-16', session: { completed: false, slot: { id: second.id } } }]);
  expect(preview.nextId).toMatch(/^strength:/);
  expect(pendingAgendaSession(runs[0])).toBe(false);
  expect(agendaMove(preview.rows, runs[0].id, 1)).toBeNull();
  expect(agenda('2026-11-15', []).nextId).toBeUndefined();
  const due = agenda('2026-11-16', []);
  expect(due.nextId).toBe(runs[0].id);
  expect(due.rows.find(row => row.id === due.nextId)).not.toHaveProperty('upcoming');
});

it('merges the rescheduled cycle-two run into the current agenda without completing it or keeping the old run in its place', () => {
  const { block, workouts } = weeklyCardioAgendaFixture();
  const [first, second] = block.slots;
  const shiftedStart = { ...block, startDate: '2026-11-10', slots: [
    { ...first, date: '2026-11-10' }, { ...second, date: '2026-11-17' },
  ] };
  const edited = changeCardioSlot(shiftedStart, second.id, '2026-11-16', 'CARDIO', null, workouts, Date.UTC(2026, 10, 16, 11));
  expect(edited.slots[0]).toEqual(shiftedStart.slots[0]);
  const { routine: sample } = cardioHomeFixture(owner, now);
  const routine = { ...sample, mesocycleSnapshot: { ...sample.mesocycleSnapshot!,
    restDays: routineRestDays(sample.mesocycleSnapshot!).slice(0, 5) } };
  const before = trainingAgenda(owner, [routine], [shiftedStart], workouts, [], '2026-11-16');
  expect(before.rows.filter(row => row.kind === 'cardio')).toMatchObject([
    { upcoming: true, date: '2026-11-17', session: { slot: { id: second.id, cycle: 1 } } },
  ]);
  const agenda = trainingAgenda(owner, [routine], [edited], workouts, [], '2026-11-16');
  const [run] = agenda.rows.filter(row => row.kind === 'cardio');
  expect(agenda.rows.filter(row => row.kind === 'cardio')).toHaveLength(1);
  expect(run).toMatchObject({ date: '2026-11-16', session: { completed: false, slot: { id: second.id, cycle: 1 } } });
  expect(agenda.nextId).toBe(run.id);
  const later = agendaMove(agenda.rows, run.id, 1)!;
  const reordered = trainingAgenda(owner, [routine], [edited], workouts, [], '2026-11-16', [later]);
  expect(reordered.rows.findIndex(row => row.id === run.id)).toBeGreaterThan(reordered.rows.findIndex(row => row.id === later.anchor));
  expect(reordered.rows.find(row => row.id === run.id)).toEqual(run);
});

it('merges according to the cardio forecast when its strength days differ from the actual strength row positions', () => {
  const { routine } = cardioHomeFixture(owner, now);
  const sessions = routine.microcycles[routine.currentMicrocycleIndex].sessions;
  const block = cardioFixture({ sessions: 1, allowDoubles: true, strength: sessions.map((session, index) => ({
    id: `${routine.id}:${session.plannedSessionIndex}`, name: session.name,
    dayIndex: index === 0 ? 3 : 6, estimatedMinutes: 40, lowerBodyDemand: 'LOW',
  })) });
  const planned = { ...block, proposal: { ...block.proposal, strengthSource: { ...block.proposal.strengthSource!, routineId: routine.id } },
    slots: block.slots.map(slot => !slot.cycle ? { ...slot, date: '2026-11-02' } : slot) };
  const rows = trainingAgenda(owner, [routine], [planned], [], [], today).rows.filter(row => row.kind !== 'rest');
  expect(rows.map(row => row.kind)).toEqual(['strength', 'cardio', 'strength']);
});

it('retains only the finished second cardio cycle after an early run with strength still pending', () => {
  const { block, workouts } = weeklyCardioAgendaFixture();
  const plan = createCardioBlock(block.id, block.proposal, '2026-11-10', 3, block.timeZone, block.createdAt);
  const second = plan.slots[1];
  const started = Date.UTC(2026, 10, 16, 12);
  const edited = changeCardioSlot(plan, second.id, '2026-11-16', 'CARDIO', null, workouts, started - 1);
  const finished = transitionCardioWorkout(startCardioWorkout(edited, second.id, started, 'second'), 'FINISH', started + 60000, 60);
  const { routine } = cardioHomeFixture(owner, now);
  for (const day of ['2026-11-16', '2026-11-17']) {
    const agenda = trainingAgenda(owner, [routine], [edited], [...workouts, finished], [], day);
    expect(agenda.rows.filter(row => row.kind === 'cardio')).toMatchObject([
      { date: '2026-11-16', session: { completed: true, slot: { id: second.id, cycle: 1 } } },
    ]);
    expect(agenda.nextId).toMatch(/^strength:/);
  }
});

it('keeps equal-duration linked cardio on the matching strength cycle until strength advances', () => {
  const { routine, block } = cardioHomeFixture(owner, now);
  const firstCycle = block.slots.filter(slot => slot.cycle === 0);
  const workouts = firstCycle.map((slot, index) =>
    transitionCardioWorkout(startCardioWorkout(block, slot.id, now, `done-${index}`), 'FINISH', now + 60000, 60));
  const held = trainingAgenda(owner, [routine], [block], workouts, [], '2026-11-09');
  expect(held.rows.filter(row => row.kind === 'cardio').map(row => [row.session.slot.cycle, row.session.completed]))
    .toEqual(firstCycle.map(() => [0, true]));
  const advanced = trainingAgenda(owner, [{ ...routine, currentMicrocycleIndex: 1 }], [block], workouts, [], '2026-11-09');
  expect(advanced.rows.filter(row => row.kind === 'cardio').map(row => row.session.slot.cycle))
    .toEqual(block.slots.filter(slot => slot.cycle === 1).map(() => 1));
});

it('separates different durations and rejects relative moves between their groups', () => {
  const { routine } = cardioHomeFixture(owner, now), { block } = weeklyCardioAgendaFixture();
  const { rows } = trainingAgenda(owner, [routine], [block], [], [], '2026-11-09');
  const runIndex = rows.findIndex(row => row.kind === 'cardio');
  expect(rows[runIndex].group).toBe(block.id);
  expect(runIndex).toBeGreaterThan(rows.findLastIndex(row => row.kind === 'strength'));
  expect(agendaMoveTo(rows, runIndex, runIndex - 1)).toBeNull();
});
