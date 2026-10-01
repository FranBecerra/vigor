import { EXERCISE_CATALOGUE } from '../exerciseCatalogue';
import { hipFamily, isDemandingTorsoHinge, redundantSessionPair } from '../exerciseFamilies';
import { distributeSelection } from '../sessionDistribution';
import { SplitStructure } from '@/models';

const exercise = (id: string) => EXERCISE_CATALOGUE.find((e) => e.id === id)!;
it('distinguishes a supported thrust from two near-equivalent torso hinges', () => {
  const rdl = exercise('peso-muerto-rumano'); const thrust = exercise('hip-thrust');
  expect(hipFamily(rdl)).toBe('TORSO_HINGE');
  expect(hipFamily(thrust)).toBe('SUPPORTED_THRUST');
  expect(isDemandingTorsoHinge(thrust)).toBe(false);
  expect(redundantSessionPair(rdl, thrust)).toBe(false);
  expect(redundantSessionPair(thrust, rdl)).toBe(false);
  expect(redundantSessionPair(rdl, exercise('peso-muerto-rumano-mancuernas'))).toBe(true);
  expect(redundantSessionPair(rdl, exercise('peso-muerto-convencional'))).toBe(true);
});
it('allows RDL and hip thrust in a single feasible session without changing dose', () => {
  const selected = ['peso-muerto-rumano', 'hip-thrust'].map((id) => ({ exercise: exercise(id), sets: 3 }));
  const result = distributeSelection({ selection: { selected }, split: SplitStructure.FULL_BODY, sessionsPerMicrocycle: 1 });
  expect(result.unassigned).toEqual([]);
  expect(result.sessions[0].exercises.map((e) => e.exercise.id).sort()).toEqual(selected.map((e) => e.exercise.id).sort());
});
it('handles unknown hip mechanics conservatively and keeps unrelated movement coverage intact', () => {
  const rdl = exercise('peso-muerto-rumano');
  expect(hipFamily({ ...rdl, id: 'custom', name: 'Custom' })).toBe('UNVERIFIED');
  expect(hipFamily(exercise('press-banca'))).toBeNull();
  expect(redundantSessionPair(exercise('press-banca'), exercise('press-banca'))).toBe(true);
  expect(redundantSessionPair(exercise('press-banca'), exercise('curl-barra'))).toBe(false);
});
