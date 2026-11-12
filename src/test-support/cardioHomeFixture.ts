import { hybridFixture } from './hybridFixture';
import { prepareHybridBundle } from '@/services/cardio/hybridAuthoring';
import { createCardioBlock, dateInZone } from '@/services/cardio/cardioBlock';
import { toRoutineView } from '@/services/training/routineView';

/** Fabricated eight-day data shared by UI acceptance; no store access or writes. */
export function cardioHomeFixture(owner = 'owner', now = Date.now()) {
  const f = hybridFixture();
  f.draft.routine.userId = owner; f.draft.mesocycle.userId = owner;
  f.draft.mesocycle.startedAt = now - 1000;
  const bundle = prepareHybridBundle(f.draft, f.input, f.settings, f.exercises, f.labels, now);
  const routine = toRoutineView({ ...bundle.routine, name: 'Strength fixture', isActive: true }, bundle.mesocycle, f.exercises, f.labels)!;
  const block = createCardioBlock('cardio-home-fixture', { ...bundle.cardio, name: 'Cardio fixture' }, dateInZone(now, 'Europe/Madrid'), 4, 'Europe/Madrid', now);
  return { routine, block };
}
