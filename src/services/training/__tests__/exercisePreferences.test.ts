import { exercisePreference, isValidExercisePreference, recommendedExerciseIds } from '../exercisePreferences';

describe('exercise preferences', () => {
  it('accepts only an exercise preference owned by the active user', () => {
    const preference = exercisePreference('press-banca', 'owner', true, 123);
    expect(isValidExercisePreference(preference, 'owner')).toBe(true);
    expect(isValidExercisePreference(preference, 'other')).toBe(false);
    expect(isValidExercisePreference({ ...preference, id: 'other-id' }, 'owner')).toBe(false);
    expect(isValidExercisePreference({ ...preference, updatedAt: Number.NaN }, 'owner')).toBe(false);
    expect(isValidExercisePreference({ ...preference, notRecommended: 'yes' }, 'owner')).toBe(false);
    expect(isValidExercisePreference(null, 'owner')).toBe(false);
  });

  it('returns only currently vetoed ids and ignores false entries', () => {
    const ids = recommendedExerciseIds([
      exercisePreference('a', 'owner', true, 1),
      exercisePreference('b', 'owner', false, 2),
      exercisePreference('c', 'owner', true, 3),
    ]);
    expect([...ids].sort()).toEqual(['a', 'c']);
  });
});
