import { ExperienceLevel, ExerciseProfile, MuscleGroup, SetType, SplitStructure } from '@/models';
import { hybridTemplates } from '../hybridTemplates';
import { hybridFixture, hybridRunningFixture } from '@/test-support/hybridFixture';
import type { HybridStrengthDraft } from '../hybridAuthoring';
import { suggestHybridStructure } from '../hybridStructure';
import { prepareHybridBundle, reviewHybridAuthoring, validHybridBundle } from '../hybridAuthoring';
import { availabilityHybridSettings, suggestHybridFrequency, withHybridAvailability } from '../hybridAvailability';
import { suggestHybridRhythm } from '../hybridRhythm';
import { hybridLegSets, strengthPlacements, type CardioPreviewInput } from '../cardioPreview';
import { toRoutineView } from '@/services/training/routineView';
import { toPlannedSessions } from '@/services/training/routineMapper';
import { planDoseFirstMesocycle } from '@/services/training/mesocyclePlanner';
import { TrainingGoal } from '@/services/training/volumePlan';

function setup() {
  const f = hybridRunningFixture(), rows = f.sessions;
  const calf = [...f.exercises.values()].find(e => e.primaryMuscle === MuscleGroup.CALVES && e.profile === ExerciseProfile.ISOLATION)!;
  rows[0].exercises.push({ ...rows[0].exercises[0], exerciseId: calf.id, order: 4, sets: [{setType:SetType.NORMAL,targetRIR:2,targetReps:12}] });
  const propose = () => {
    const view = toRoutineView(f.draft.routine,f.draft.mesocycle,f.exercises,f.labels)!;
    const input = { ...f.input, strength: strengthPlacements(view,true).sessions };
    return suggestHybridStructure(f.draft,input,f.settings,f.exercises,f.labels,reviewHybridAuthoring(f.draft,input,f.settings,f.exercises,f.labels));
  };
  return { ...f, calf, propose };
}
it('compares the whole routine and only saves the reviewed arrangement', () => {
  const f = setup(), before = JSON.stringify(f.draft), next = f.propose()!;
  expect(next.moves.map(m => [m.exercise.id,m.fromDay,m.toDay])).toEqual([[f.calf.id,1,5]]);
  const work = (rows: typeof f.sessions) => rows.flatMap(s => s.exercises.map(e => [e.exerciseId,JSON.stringify(e.sets)])).sort();
  expect(work(next.strength.mesocycle.plannedSessions!)).toEqual(work(f.sessions));
  expect(JSON.stringify(f.draft)).toBe(before);
  expect(validHybridBundle(prepareHybridBundle(next.strength,next.cardio,f.settings,f.exercises,f.labels,1800000000000),'owner')).toBe(true);
});
it('protects manual sets, strength roles, supersets, revisions and the chosen split', () => {
  const f = setup(), calf = f.sessions[0].exercises[4];
  calf.isEdited = true; expect(f.propose()).toBeNull(); calf.isEdited = false;
  calf.strengthRole = 'MAIN'; expect(f.propose()).toBeNull(); calf.strengthRole = 'ACCESSORY';
  f.sessions[0].supersets = { a:'b' }; expect(f.propose()).toBeNull(); delete f.sessions[0].supersets;
  f.sessions[1].focus = 'UPPER'; expect(f.propose()).toBeNull(); f.sessions[1].focus = 'FULL_BODY';
  f.draft.mesocycle.sessionOverrides = {}; expect(f.propose()).toBeNull();
});
it.each([7,8])('creates and saves four strength sessions and two runs in five available days of a %i-day cycle', async cycleDays => {
  for (const goal of [TrainingGoal.STRENGTH, TrainingGoal.HYPERTROPHY]) {
  const f = hybridFixture(), availability = { cycleDays, trainingDays:5, allowDoubles:true, minutesPerSession:75 };
  const settings = availabilityHybridSettings(availability,'STRENGTH'), counts = suggestHybridFrequency(availability,'STRENGTH');
  expect(counts).toEqual({ strength:4,cardio:2 });
  const plan = planDoseFirstMesocycle({ level:ExperienceLevel.INTERMEDIATE, goal, catalogue:[...f.exercises.values()], seed:42,
    split:SplitStructure.UPPER_LOWER, capacity:{sessionsPerMicrocycle:counts.strength,minutesPerSession:availability.minutesPerSession} });
  const sessions = toPlannedSessions(plan,false,{ preserveFocus:true });
  f.draft.routine.generation = { ...f.draft.routine.generation, goal, split:SplitStructure.UPPER_LOWER, sessionsPerMicrocycle:4, minutesPerSession:75 };
  f.draft.mesocycle.sessionsPerMicrocycle = 4; f.draft.mesocycle.plannedSessions = sessions;
  const view = toRoutineView(f.draft.routine,f.draft.mesocycle,f.exercises,f.labels)!;
  const input = withHybridAvailability({ ...f.input, modalities:['RUNNING'], spacingPolicy:'SPREAD_EASY_V1', sessions:counts.cardio,sessionMinutes:40,
    strength:strengthPlacements(view,true).sessions.map((s,i) => ({ ...s,dayIndex:i })) },availability);
  const result = await suggestHybridRhythm(input,{legSets:hybridLegSets(view),yieldControl:async()=>undefined});
  const review = reviewHybridAuthoring(f.draft,result.input,settings,f.exercises,f.labels);
  expect(review.issues).toEqual([]);
  const alt = suggestHybridStructure(f.draft,result.input,settings,f.exercises,f.labels,review);
  const bundle = prepareHybridBundle(alt?.strength ?? f.draft,alt?.cardio ?? result.input,settings,f.exercises,f.labels,1800000000000);
  expect(validHybridBundle(bundle,'owner')).toBe(true);
  expect(bundle.cardio.preview.scheduled).toHaveLength(2);
  expect(bundle.cardio.input.strength).toHaveLength(4);
  expect(bundle.cardio.preview.activeDays.length).toBeLessThanOrEqual(5);
  expect(new Set(bundle.cardio.preview.scheduled.map(s=>s.dayIndex)).size).toBe(2);
  }
});

it('compares eligible AUTO templates against actual runs before selecting a strength roster', () => {
  const f = hybridRunningFixture(), rows = f.sessions;
  const view = toRoutineView(f.draft.routine,f.draft.mesocycle,f.exercises,f.labels)!;
  const review = reviewHybridAuthoring(f.draft,f.input,f.settings,f.exercises,f.labels);
  const draft: HybridStrengthDraft = { ...f.draft, routine: { ...f.draft.routine, generation: { ...f.draft.routine.generation,split:'AUTO' } },
    templates:[{ split:SplitStructure.UPPER_LOWER, routineName:'Upper / lower',
      sessions:rows.map((s,i) => ({ ...s,exercises:rows[1-i].exercises })) }] };
  const best = suggestHybridStructure(draft,f.input,f.settings,f.exercises,f.labels,review)!;
  expect(best.split).toBe(SplitStructure.UPPER_LOWER);
  expect(best.strength.routine.name).toBe('Upper / lower');
  expect(hybridLegSets(best.review.view).get(view.id+':0')).toBe(2);
  expect(validHybridBundle(prepareHybridBundle(best.strength,best.cardio,f.settings,f.exercises,f.labels,1800000000000),'owner')).toBe(true);
});
it('builds candidate templates from the original strength selection; explicit splits remain authoritative', () => {
  const f = hybridFixture(), input = { level:ExperienceLevel.INTERMEDIATE, goal:TrainingGoal.HYPERTROPHY, split:SplitStructure.AUTO,
    catalogue:[...f.exercises.values()], seed:42,capacity:{sessionsPerMicrocycle:4,minutesPerSession:75} };
  const plan = planDoseFirstMesocycle(input);
  const variants = hybridTemplates(input,plan);
  expect(variants.length).toBeGreaterThan(0);
  const dose = (rows: typeof f.draft.mesocycle.plannedSessions) => {
    const counts: Record<string,number> = {};
    for (const s of rows!) for (const e of s.exercises) counts[e.exerciseId] = (counts[e.exerciseId] ?? 0)+e.sets.length;
    return counts;
  };
  for (const v of variants) expect(dose(v.sessions)).toEqual(dose(toPlannedSessions(plan)));
  expect(hybridTemplates({ ...input,split:SplitStructure.FULL_BODY },plan)).toEqual([]);
});

it('leaves incomplete calendars, empty prescriptions and missing exercise metadata untouched', () => {
  const f = setup();
  const view = toRoutineView(f.draft.routine,f.draft.mesocycle,f.exercises,f.labels)!;
  const validInput = { ...f.input,strength:strengthPlacements(view,true).sessions };
  const review = reviewHybridAuthoring(f.draft,validInput,f.settings,f.exercises,f.labels);
  const check = (input: CardioPreviewInput, draft = f.draft, catalogue = f.exercises) =>
    suggestHybridStructure(draft,input,f.settings,catalogue,f.labels,review);
  expect(check({ ...f.input, strength:f.input.strength.map(s => ({ ...s,dayIndex:undefined })) })).toBeNull();
  expect(check({ ...f.input, strength:f.input.strength.map(s => ({ ...s,dayIndex:0 })) })).toBeNull();
  expect(check(f.input,{ ...f.draft,mesocycle:{ ...f.draft.mesocycle,plannedSessions:undefined } })).toBeNull();
  expect(check(f.input,f.draft,new Map())).toBeNull();
  expect(check({ ...f.input,modalities:['CYCLING'] })).toBeNull();
});
