import { SetType } from '@/models';
import { hybridRunningFixture } from '@/test-support/hybridFixture';
import { prepareHybridBundle, reviewHybridAuthoring, validHybridBundle } from '../hybridAuthoring';
import { hybridLegAlternative } from '../hybridLegAlternative';

function setup() {
  const f = hybridRunningFixture(), {input} = f;
  const propose = () => hybridLegAlternative(f.draft,input,f.settings,f.exercises,f.labels,
    reviewHybridAuthoring(f.draft,input,f.settings,f.exercises,f.labels));
  return { ...f, propose };
}
it('moves a single prescribed set away from the run and saves that exact reviewed bundle', () => {
  const f = setup(), original = JSON.stringify(f.draft), alt = f.propose()!;
  expect(alt).toMatchObject({ fromDay: 1,toDay: 5 });
  expect(alt.strength.mesocycle.plannedSessions!.map(s => s.exercises[0].sets.length)).toEqual([3,3]);
  expect(alt.review.preview.scheduled[0].dayIndex).toBe(1);
  const saved = prepareHybridBundle(alt.strength,alt.cardio,f.settings,f.exercises,f.labels,1800000000000);
  expect(validHybridBundle(saved,'owner')).toBe(true);
  expect(saved.mesocycle.plannedSessions).toEqual(alt.strength.mesocycle.plannedSessions);
  expect(JSON.stringify(f.draft)).toBe(original);
});
it('protects edited, advanced, supersetted and revised prescriptions', () => {
  const f = setup(), exercise = f.sessions[0].exercises[0];
  exercise.isEdited = true; expect(f.propose()).toBeNull(); exercise.isEdited = false;
  exercise.sets[0].setType = SetType.FAILURE; expect(f.propose()).toBeNull(); exercise.sets[0].setType = SetType.NORMAL;
  f.sessions[0].supersets = { a:'b' }; expect(f.propose()).toBeNull(); delete f.sessions[0].supersets;
  f.draft.mesocycle.sessionOverrides = {}; expect(f.propose()).toBeNull();
});
