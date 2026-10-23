import { ExperienceLevel } from '@/models/athlete';

export const EXPERIENCE_QUESTIONS = [
  { id: 'consistency', options: ['STARTING_RETURNING', 'REGULAR', 'CONSISTENT_YEARS'] },
  { id: 'technique', options: ['LEARNING', 'ESTABLISHED'] },
  { id: 'progress', options: ['FREQUENT', 'GRADUAL', 'SLOW', 'UNSURE'] },
] as const;

export interface ExperienceAnswers {
  consistency?: typeof EXPERIENCE_QUESTIONS[0]['options'][number];
  technique?: typeof EXPERIENCE_QUESTIONS[1]['options'][number];
  progress?: typeof EXPERIENCE_QUESTIONS[2]['options'][number];
}

export type ExperienceRecommendation = {
  level: ExperienceLevel;
  reason: 'returning' | 'foundation' | 'established' | 'experienced';
};

/** A transparent starting-plan heuristic, not an assessment of physiological capacity. */
export function recommendExperience(answers: ExperienceAnswers): ExperienceRecommendation | null {
  if (!EXPERIENCE_QUESTIONS.every((question) =>
    (question.options as readonly unknown[]).includes(answers[question.id]))) return null;
  if (answers.consistency === 'STARTING_RETURNING') return { level: ExperienceLevel.BEGINNER, reason: 'returning' };
  if (answers.technique === 'LEARNING') return { level: ExperienceLevel.BEGINNER, reason: 'foundation' };
  if (answers.consistency === 'CONSISTENT_YEARS' && answers.progress === 'SLOW') {
    return { level: ExperienceLevel.ADVANCED, reason: 'experienced' };
  }
  return { level: ExperienceLevel.INTERMEDIATE, reason: 'established' };
}
