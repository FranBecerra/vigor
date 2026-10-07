/** Review triggers, not physiological rules or automatic exercise bans. */
import { ExperienceLevel, MovementVector, MuscleGroup, type Exercise, type PlannedSession, type PlannedSessionFocus } from '@/models';
import type { DistributedSession } from './sessionDistribution';
import type { SessionFocus } from './sessionDistribution';
import { LOWER_BODY_MUSCLES as lower } from './muscleGroups';

const press = new Set([MovementVector.PUSH_HORIZONTAL, MovementVector.PUSH_VERTICAL]);
const pull = new Set([MovementVector.PULL_HORIZONTAL, MovementVector.PULL_VERTICAL]);
const unsupportedRows = new Set(['remo-con-barra', 'remo-barra-agarre-supino', 'remo-t']);
const techniqueDemand = new Set(['buenos-dias', 'nordic-curl', ...unsupportedRows]);

const neutral = new Set([MuscleGroup.CORE, MuscleGroup.ERECTORS, MuscleGroup.FOREARMS, MuscleGroup.NECK]);
const pushMuscles = new Set([MuscleGroup.CHEST, MuscleGroup.DELTS_FRONT, MuscleGroup.TRICEPS]);
const pullMuscles = new Set([MuscleGroup.LATS, MuscleGroup.MID_BACK, MuscleGroup.DELTS_REAR, MuscleGroup.BICEPS]);
// Knee-dominant work sits on the push side and hip hinges and leg curls on the
// pull side, so a push or pull day may carry legs. Isolated hip, adductor and
// calf work does not decide it.
const pushLegs = new Set([MovementVector.KNEE_DOMINANT, MovementVector.KNEE_EXTENSION, MovementVector.UNILATERAL_KNEE]);
const pullLegs = new Set([MovementVector.HIP_DOMINANT, MovementVector.KNEE_FLEXION]);
const side = ({ primaryMuscle: m, movementVector: v }: Exercise): 'push' | 'pull' | undefined => {
  if (lower.has(m)) return pushLegs.has(v) ? 'push' : pullLegs.has(v) ? 'pull' : undefined;
  return pushMuscles.has(m) ? 'push' : pullMuscles.has(m) ? 'pull' : undefined;
};

/**
 * Name a session by the muscle groups it trains, not by the split slot it was
 * planned for. Lower only is legs. Otherwise push-side only is push, pull-side
 * only is pull, and a mix is upper or full body depending on lower work.
 * Core, lumbar, forearm and neck work never decide it.
 */
export function sessionPresentationFocus(session: DistributedSession): SessionFocus {
  const work = session.exercises.map((e) => e.exercise).filter((e) => !neutral.has(e.primaryMuscle));
  if (work.length === 0) return session.focus;
  const hasLower = work.some((e) => lower.has(e.primaryMuscle));
  const hasUpper = work.some((e) => !lower.has(e.primaryMuscle));
  if (!hasUpper) return session.focus === 'LEGS' ? 'LEGS' : 'LOWER';
  const sides = new Set(work.map(side));
  if (sides.has('push') && !sides.has('pull')) return 'PUSH';
  if (sides.has('pull') && !sides.has('push')) return 'PULL';
  return hasLower ? 'FULL_BODY' : 'UPPER';
}

/** Same naming for a saved session, so routines stored with an older label read correctly. */
export function plannedPresentationFocus(session: PlannedSession,
  exerciseById: ReadonlyMap<string, Exercise>): PlannedSessionFocus {
  const exercises = session.exercises.flatMap((entry) => {
    const exercise = exerciseById.get(entry.exerciseId);
    return exercise ? [{ exercise, sets: entry.sets.length }] : [];
  });
  return sessionPresentationFocus({ index: session.index, focus: session.focus, estimatedWorkMinutes: 0, exercises });
}

export interface CoherenceFinding { code: string; subject?: string; actual: number; limit: number }
export function reviewSessionCoherence(session: DistributedSession, level: ExperienceLevel,
  targetMuscles: ReadonlySet<MuscleGroup>): CoherenceFinding[] {
  if (!session.exercises.length) return [];
  const findings: CoherenceFinding[] = [];
  const has = (vectors: ReadonlySet<MovementVector>) => session.exercises.some((e) => vectors.has(e.exercise.movementVector));
  // Flexible leg/delt spillover is allowed. This only asks for review when the
  // named focus lacks its basic task AND that task's muscles were requested.
  if (session.focus === 'PUSH' && (targetMuscles.has(MuscleGroup.CHEST) || targetMuscles.has(MuscleGroup.DELTS_FRONT)) && !has(press)) {
    findings.push({ code: 'focus-without-press', actual: 0, limit: 1 });
  }
  if (session.focus === 'PULL' && (targetMuscles.has(MuscleGroup.LATS) || targetMuscles.has(MuscleGroup.MID_BACK)) && !has(pull)) {
    findings.push({ code: 'focus-without-pull', actual: 0, limit: 1 });
  }
  if ((session.focus === 'LEGS' || session.focus === 'LOWER') && [...targetMuscles].some((m) => lower.has(m))
    && !session.exercises.some((e) => lower.has(e.exercise.primaryMuscle))) {
    findings.push({ code: 'focus-without-lower-work', actual: 0, limit: 1 });
  }
  if (level === ExperienceLevel.BEGINNER) for (const { exercise } of session.exercises) {
    if (techniqueDemand.has(exercise.id)) findings.push({ code: 'beginner-technique-review', subject: exercise.id, actual: 1, limit: 0 });
  }
  const rowCount = session.exercises.filter((e) => unsupportedRows.has(e.exercise.id)).length;
  if (rowCount > 1) findings.push({ code: 'unsupported-row-concentration', actual: rowCount, limit: 1 });
  return findings;
}
