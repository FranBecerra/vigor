import type { Exercise, Mesocycle, Routine, ScheduleTemplate } from '@/models';
import { toRoutineView, type RoutineViewLabels } from '@/services/training/routineView';
import { strengthPlacements, buildCardioPreview, cardioPreviewIssue, type CardioPreviewInput } from './cardioPreview';
import { cardioPlanPolicy, cardioStrengthSource, saveCardioProposal, validSavedCardioPlan, type SavedCardioPlan } from './savedCardioPlan';
import { validSportIdentity } from './sportActivities';

export type HybridPriority = 'STRENGTH' | 'BALANCED' | 'CARDIO';
export interface HybridSettings { priority: HybridPriority; totalMinutesPerCycle: number; maxSessionMinutes: number }
export interface HybridStrengthDraft { routine: Routine; mesocycle: Mesocycle; templates?: readonly import('./hybridTemplates').HybridTemplate[] }
export interface HybridBundle extends HybridStrengthDraft { cardio: SavedCardioPlan }
const integer = (n: unknown, min: number, max: number): n is number => typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;
export function validHybridSettings(value: unknown): value is HybridSettings {
  if (!value || typeof value !== 'object') return false;
  const s = value as HybridSettings;
  return ['STRENGTH', 'BALANCED', 'CARDIO'].includes(s.priority)
    && integer(s.totalMinutesPerCycle, 30, 10000) && integer(s.maxSessionMinutes, 30, 180);
}
export function hybridSameDayOrder(priority: HybridPriority) {
  if (!['STRENGTH', 'BALANCED', 'CARDIO'].includes(priority)) throw Error('invalidHybridPriority');
  return priority === 'BALANCED' ? 'CHOOSE_PRIORITY_SESSION' : priority === 'CARDIO' ? 'CARDIO_FIRST' : 'STRENGTH_FIRST';
}
function strengthView(draft: HybridStrengthDraft, exercises: ReadonlyMap<string, Exercise>, labels: RoutineViewLabels) {
  if (!draft?.routine || !draft.mesocycle || !validSportIdentity(draft.routine.id) || !validSportIdentity(draft.mesocycle.id)
    || !validSportIdentity(draft.routine.userId) || draft.routine.userId !== draft.mesocycle.userId
    || draft.mesocycle.routineId !== draft.routine.id || draft.routine.activeMesocycleId !== draft.mesocycle.id
    || draft.mesocycle.currentMicrocycleIndex !== 0 || draft.mesocycle.status !== 'ACTIVE'
    || draft.mesocycle.trainingCalendar || draft.mesocycle.skippedSessions
    || !Array.isArray(draft.mesocycle.plannedSessions) || !draft.mesocycle.plannedSessions.length
    || draft.mesocycle.plannedSessions.some(s => !integer(s.index, 0, 30) || !s.exercises.length)
    || new Set(draft.mesocycle.plannedSessions.map(s => s.index)).size !== draft.mesocycle.plannedSessions.length) throw Error('invalidHybridStrength');
  const view = toRoutineView(draft.routine, draft.mesocycle, exercises, labels);
  if (!view || view.microcycles[0].sessions.some(s => s.exercises.length !== draft.mesocycle.plannedSessions!.find(p => p.index === s.plannedSessionIndex)!.exercises.length)) throw Error('invalidHybridCatalogue');
  return view;
}

/** Joint review of authored doses. Never silently trims sets, cardio or availability. */
export function reviewHybridAuthoring(draft: HybridStrengthDraft, input: CardioPreviewInput, settings: HybridSettings,
  exercises: ReadonlyMap<string, Exercise>, labels: RoutineViewLabels) {
  if (!validHybridSettings(settings) || cardioPreviewIssue(input)) throw Error('invalidHybridInput');
  const view = strengthView(draft, exercises, labels), source = strengthPlacements(view, true).sessions;
  if (input.strength.length !== source.length || input.strength.some(s => {
    const original = source.find(p => p.id === s.id);
    return !original || s.name !== original.name || s.estimatedMinutes !== original.estimatedMinutes || s.lowerBodyDemand !== original.lowerBodyDemand
      || !input.availableDays.includes(s.dayIndex!);
  })) throw Error('invalidHybridStrengthPlacement');
  const preview = buildCardioPreview(input), strengthMinutes = source.reduce((sum, s) => sum + s.estimatedMinutes, 0);
  const totalMinutes = strengthMinutes + preview.usedMinutes;
  const issues: Array<'TOTAL_TIME' | 'SESSION_TIME' | 'CARDIO_OMITTED'> = [];
  if (totalMinutes > settings.totalMinutesPerCycle) issues.push('TOTAL_TIME');
  if ([...source.map(s => s.estimatedMinutes), ...preview.scheduled.map(s => s.durationMinutes)].some(n => n > settings.maxSessionMinutes)) issues.push('SESSION_TIME');
  if (preview.omitted.length || preview.scheduled.length !== input.sessions) issues.push('CARDIO_OMITTED');
  return { view, preview, strengthMinutes, totalMinutes, issues, sameDayOrder: hybridSameDayOrder(settings.priority) };
}

/** Materialize both prescriptions only after the joint review, with stable retry IDs. */
export function prepareHybridBundle(draft: HybridStrengthDraft, input: CardioPreviewInput, settings: HybridSettings,
  exercises: ReadonlyMap<string, Exercise>, labels: RoutineViewLabels, now: number, healthSaveAccepted = false): HybridBundle {
  const review = reviewHybridAuthoring(draft, input, settings, exercises, labels);
  if (review.issues.length || !Number.isSafeInteger(now) || now <= 0 || now > 8.64e15) throw Error('hybridCapacityExceeded');
  const template: ScheduleTemplate = { days: input.cycleDays, slots: Array.from({ length: input.cycleDays }, (_, day) => {
    const s = input.strength.find(p => p.dayIndex === day);
    return s ? { kind: 'workout' as const, sessionIndex: draft.mesocycle.plannedSessions!.find(p => `${draft.routine.id}:${p.index}` === s.id)!.index }
      : { kind: 'rest' as const };
  }) };
  const cardioId = `${draft.routine.id}-cardio`;
  const routine: Routine = { ...draft.routine, isActive: false, hybrid: { policy: 'HYBRID_AUTHORING_V1', cardioPlanId: cardioId,
    priority: settings.priority, totalMinutesPerCycle: settings.totalMinutesPerCycle, maxSessionMinutes: settings.maxSessionMinutes } };
  const mesocycle: Mesocycle = { ...draft.mesocycle, scheduleTemplate: template };
  const view = strengthView({ routine, mesocycle }, exercises, labels);
  const cardio = saveCardioProposal(cardioId, routine.userId, routine.name, input, cardioStrengthSource(view, cardioPlanPolicy(input)), now, healthSaveAccepted);
  return JSON.parse(JSON.stringify({ routine, mesocycle, cardio })) as HybridBundle;
}

/** Repository boundary: only linked, new, inactive prescriptions are accepted. */
export function validHybridBundle(value: HybridBundle, owner: string): boolean {
  try {
    const { routine: r, mesocycle: m, cardio: c } = value;
    return validSportIdentity(owner) && /^hybrid-[a-zA-Z0-9]{20}$/.test(r.id) && m.id === `${r.id}-m0` && c.id === `${r.id}-cardio` && r.userId === owner && m.userId === owner
      && r.isActive === false && r.activeMesocycleId === m.id && m.routineId === r.id && m.currentMicrocycleIndex === 0
      && m.status === 'ACTIVE' && !!m.plannedSessions?.length && !m.trainingCalendar && !m.skippedSessions
      && r.hybrid?.policy === 'HYBRID_AUTHORING_V1' && r.hybrid.cardioPlanId === c.id
      && ['STRENGTH', 'BALANCED', 'CARDIO'].includes(r.hybrid.priority) && integer(r.hybrid.totalMinutesPerCycle, 30, 10000)
      && integer(r.hybrid.maxSessionMinutes, 30, 180)
      && validSavedCardioPlan(c, owner) && c.archivedAt === null && c.strengthSource?.routineId === r.id
      && c.strengthSource.microcycleIndex === 0 && !!m.scheduleTemplate && m.scheduleTemplate.days === c.input.cycleDays
      && c.input.strength.length === m.plannedSessions.length
      && c.input.strength.every(s => m.plannedSessions!.some(p => `${r.id}:${p.index}` === s.id
        && m.scheduleTemplate!.slots[s.dayIndex!]?.kind === 'workout'
        && (m.scheduleTemplate!.slots[s.dayIndex!] as { sessionIndex: number }).sessionIndex === p.index))
      && c.preview.omitted.length === 0 && c.preview.scheduled.length === c.input.sessions
      && [...c.preview.scheduled.map(s => s.durationMinutes), ...c.input.strength.map(s => s.estimatedMinutes)].every(n => n <= r.hybrid!.maxSessionMinutes)
      && c.preview.usedMinutes + c.input.strength.reduce((sum, s) => sum + s.estimatedMinutes, 0) <= r.hybrid.totalMinutesPerCycle;
  } catch { return false; }
}
