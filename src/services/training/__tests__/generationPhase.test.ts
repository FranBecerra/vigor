import { Equipment, ExperienceLevel, SplitStructure } from '@/models';
import {
  isPlanStale,
  primaryActionFor,
  settingsSignature,
  type GenerationSettings,
} from '@/services/training/generationPhase';
import { TrainingGoal, VolumeRegion } from '@/services/training/volumePlan';

const base: GenerationSettings = {
  goal: TrainingGoal.HYPERTROPHY,
  level: ExperienceLevel.INTERMEDIATE,
  split: SplitStructure.AUTO,
  sessionsPerMicrocycle: 4,
  minutesPerSession: 60,
  availableEquipment: [Equipment.BARBELL, Equipment.DUMBBELL],
  priorityRegions: [VolumeRegion.BACK],
  deprioritizedRegions: [],
};

describe('settingsSignature', () => {
  it('is stable for identical settings', () => {
    expect(settingsSignature(base)).toBe(settingsSignature({ ...base }));
  });

  it('ignores list order, because the generator reads the lists as membership', () => {
    expect(
      settingsSignature({
        ...base,
        availableEquipment: [Equipment.DUMBBELL, Equipment.BARBELL],
      }),
    ).toBe(settingsSignature(base));
  });

  it('separates a region moved from priority to maintenance', () => {
    expect(
      settingsSignature({
        ...base,
        priorityRegions: [],
        deprioritizedRegions: [VolumeRegion.BACK],
      }),
    ).not.toBe(settingsSignature(base));
  });

  it.each<Partial<GenerationSettings>>([
    { goal: TrainingGoal.STRENGTH },
    { level: ExperienceLevel.ADVANCED },
    { split: SplitStructure.PUSH_PULL_LEGS },
    { sessionsPerMicrocycle: 5 },
    { minutesPerSession: 75 },
    { availableEquipment: [Equipment.BARBELL] },
    { priorityRegions: [VolumeRegion.CHEST] },
    { deprioritizedRegions: [VolumeRegion.BICEPS] },
  ])('changes when a generator input moves: %o', (change) => {
    expect(settingsSignature({ ...base, ...change })).not.toBe(settingsSignature(base));
  });
});

describe('isPlanStale', () => {
  it('is false with no plan yet', () => {
    expect(isPlanStale(null, base)).toBe(false);
  });

  it('is false when the athlete only went back to look', () => {
    expect(isPlanStale(settingsSignature(base), base)).toBe(false);
  });

  it('is true once a setting moves', () => {
    expect(isPlanStale(settingsSignature(base), { ...base, minutesPerSession: 45 })).toBe(
      true,
    );
  });
});

describe('primaryActionFor', () => {
  it('saves from the preview, whatever the settings say', () => {
    expect(primaryActionFor({ phase: 'preview', hasPlan: true, stale: true })).toBe('save');
  });

  it('generates when there is nothing to show', () => {
    expect(primaryActionFor({ phase: 'configure', hasPlan: false, stale: false })).toBe(
      'generate',
    );
  });

  // The two that protect the preview edits: going forward regenerates only when the
  // settings moved, and merely returns to an untouched plan otherwise.
  it('regenerates when the settings moved under the plan', () => {
    expect(primaryActionFor({ phase: 'configure', hasPlan: true, stale: true })).toBe(
      'regenerate',
    );
  });

  it('goes forward without regenerating when nothing moved', () => {
    expect(primaryActionFor({ phase: 'configure', hasPlan: true, stale: false })).toBe(
      'view',
    );
  });
});
