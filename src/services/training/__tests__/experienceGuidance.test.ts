import { ExperienceLevel } from '@/models/athlete';
import { EXPERIENCE_QUESTIONS, recommendExperience, type ExperienceAnswers } from '../experienceGuidance';

const established: ExperienceAnswers = { consistency: 'REGULAR', technique: 'ESTABLISHED', progress: 'GRADUAL' };

it('requires all answers and rejects unsupported values rather than inventing a level', () => {
  expect(recommendExperience({})).toBeNull();
  for (const key of ['consistency', 'technique', 'progress'] as const) {
    expect(recommendExperience({ ...established, [key]: undefined })).toBeNull();
    expect(recommendExperience({ ...established, [key]: 'invalid' } as ExperienceAnswers)).toBeNull();
  }
});
it('gives someone returning after a long break a beginner starting plan even with established technique and slow progress', () => {
  expect(recommendExperience({ consistency: 'STARTING_RETURNING', technique: 'ESTABLISHED', progress: 'SLOW' }))
    .toEqual({ level: ExperienceLevel.BEGINNER, reason: 'returning' });
});
it('prioritizes developing technique over elapsed years or a plateau', () => {
  expect(recommendExperience({ consistency: 'CONSISTENT_YEARS', technique: 'LEARNING', progress: 'SLOW' }))
    .toEqual({ level: ExperienceLevel.BEGINNER, reason: 'foundation' });
});
it('requires consistent years plus established technique and slow tracked progress before suggesting advanced', () => {
  expect(recommendExperience({ consistency: 'CONSISTENT_YEARS', technique: 'ESTABLISHED', progress: 'SLOW' }))
    .toEqual({ level: ExperienceLevel.ADVANCED, reason: 'experienced' });
  expect(recommendExperience({ ...established, progress: 'SLOW' })?.level).toBe(ExperienceLevel.INTERMEDIATE);
  expect(recommendExperience({ ...established, consistency: 'CONSISTENT_YEARS', progress: 'FREQUENT' })?.level).toBe(ExperienceLevel.INTERMEDIATE);
});
it('allows uncertainty about progress without upgrading the recommendation', () => {
  const answers = { ...established, consistency: 'CONSISTENT_YEARS' as const, progress: 'UNSURE' as const };
  expect(recommendExperience(answers)).toEqual({ level: ExperienceLevel.INTERMEDIATE, reason: 'established' });
  expect(answers.progress).toBe('UNSURE');
});
it('returns a bounded, deterministic recommendation for every complete answer combination', () => {
  let checked = 0;
  for (const consistency of EXPERIENCE_QUESTIONS[0].options) {
    for (const technique of EXPERIENCE_QUESTIONS[1].options) {
      for (const progress of EXPERIENCE_QUESTIONS[2].options) {
        const answers = { consistency, technique, progress };
        const result = recommendExperience(answers)!;
        expect(Object.values(ExperienceLevel)).toContain(result.level);
        expect(result).toEqual(recommendExperience(answers));
        if (result.level === ExperienceLevel.ADVANCED) expect(answers).toEqual({ consistency: 'CONSISTENT_YEARS', technique: 'ESTABLISHED', progress: 'SLOW' });
        checked++;
      }
    }
  }
  expect(checked).toBe(24);
});
