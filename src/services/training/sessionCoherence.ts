/** Review triggers, not physiological rules or automatic exercise bans. */
import { ExperienceLevel, MovementVector, MuscleGroup } from '@/models';
import type { DistributedSession } from './sessionDistribution';
import type { SessionFocus } from './sessionDistribution';

const press = new Set([MovementVector.PUSH_HORIZONTAL, MovementVector.PUSH_VERTICAL]);
const pull = new Set([MovementVector.PULL_HORIZONTAL, MovementVector.PULL_VERTICAL]);
const lower = new Set([MuscleGroup.QUADS, MuscleGroup.HAMSTRINGS, MuscleGroup.GLUTES,
  MuscleGroup.ADDUCTORS, MuscleGroup.CALVES, MuscleGroup.TIBIALIS]);
const unsupportedRows = new Set(['remo-con-barra', 'remo-barra-agarre-supino', 'remo-t']);
const techniqueDemand = new Set(['buenos-dias', 'nordic-curl', ...unsupportedRows]);

/** Correct an impossible label without moving work or forcing split membership. */
export function sessionPresentationFocus(session: DistributedSession): SessionFocus {
  const muscles = session.exercises.map((e) => e.exercise.primaryMuscle);
  const hasLower = muscles.some((m) => lower.has(m));
  const hasUpper = muscles.some((m) => !lower.has(m) && m !== MuscleGroup.CORE && m !== MuscleGroup.ERECTORS);
  if ((session.focus === 'LOWER' || session.focus === 'LEGS') && !hasLower && hasUpper) return 'UPPER';
  if ((session.focus === 'UPPER' || session.focus === 'PUSH' || session.focus === 'PULL') && !hasUpper && hasLower) return 'LOWER';
  return session.focus;
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
