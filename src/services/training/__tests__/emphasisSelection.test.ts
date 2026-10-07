import {
  canDeprioritize,
  canPrioritize,
  choiceOf,
  cycleChoice,
  EMPTY_EMPHASIS,
  GENERATOR_EMPHASIS_REGIONS,
  GENERATOR_EMPHASIS_GROUPS,
  isLowCost,
  prioritizeBlockedReason,
  regionBodyHalf,
  remainingSlots,
  usedSlots,
  withChoice,
  type EmphasisSelection,
} from '@/services/training/emphasisSelection';
import {
  assertEmphasisLimits,
  PRIORITY_SLOT_BUDGET,
  VolumeRegion,
} from '@/services/training/volumePlan';
import { MuscleGroup } from '@/models';
import { bodyHalfOf } from '@/services/training/muscleGroups';

const CHEST = VolumeRegion.CHEST; // expensive, 1 slot
const BACK = VolumeRegion.BACK; // expensive
const QUADS = VolumeRegion.QUADS; // expensive
const BICEPS = VolumeRegion.BICEPS; // cheap, 0.5
const TRICEPS = VolumeRegion.TRICEPS; // cheap
const CALVES = VolumeRegion.CALVES; // cheap
const CORE = VolumeRegion.CORE; // cheap

describe('slot accounting', () => {
  it('starts empty with the whole budget available', () => {
    expect(usedSlots(EMPTY_EMPHASIS)).toBe(0);
    expect(remainingSlots(EMPTY_EMPHASIS)).toBe(PRIORITY_SLOT_BUDGET);
  });

  it('charges an expensive region a whole slot and a cheap one half', () => {
    expect(usedSlots({ priority: [CHEST], deprioritized: [] })).toBe(1);
    expect(usedSlots({ priority: [BICEPS], deprioritized: [] })).toBe(0.5);
  });

  it('never reports negative remaining slots', () => {
    // Not reachable through the UI, but the arithmetic must not go negative.
    const overfull: EmphasisSelection = { priority: [CHEST, BACK, QUADS], deprioritized: [] };
    expect(remainingSlots(overfull)).toBe(0);
  });

  it('classifies cost the same way the volume plan does', () => {
    expect(isLowCost(BICEPS)).toBe(true);
    expect(isLowCost(CHEST)).toBe(false);
  });
});

describe('canPrioritize', () => {
  it('allows two expensive regions and then refuses a third', () => {
    const two: EmphasisSelection = { priority: [CHEST, BACK], deprioritized: [] };
    expect(usedSlots(two)).toBe(PRIORITY_SLOT_BUDGET);
    expect(canPrioritize(two, QUADS)).toBe(false);
  });

  it('allows an expensive plus two cheap regions, which is the three-region case', () => {
    const mixed: EmphasisSelection = { priority: [CHEST, BICEPS], deprioritized: [] };
    expect(canPrioritize(mixed, TRICEPS)).toBe(true);
    const three = withChoice(mixed, TRICEPS, 'PRIORITY');
    expect(three.priority).toHaveLength(3);
    expect(usedSlots(three)).toBe(PRIORITY_SLOT_BUDGET);
  });

  it('refuses a FOURTH cheap region even though the slots would fit', () => {
    // Four cheap regions cost exactly the budget, so only the hard region cap stops
    // a plan whose every region is prioritised, which is a plan with no priorities.
    const three: EmphasisSelection = {
      priority: [BICEPS, TRICEPS, CALVES],
      deprioritized: [],
    };
    expect(usedSlots(three)).toBe(1.5);
    expect(remainingSlots(three)).toBe(0.5);
    expect(canPrioritize(three, CORE)).toBe(false);
  });

  it('stays enabled for a region already prioritised, so a tap can deselect it', () => {
    const full: EmphasisSelection = { priority: [CHEST, BACK], deprioritized: [] };
    expect(canPrioritize(full, CHEST)).toBe(true);
  });
});

describe('prioritizeBlockedReason', () => {
  it('reports no reason when the region fits', () => {
    expect(prioritizeBlockedReason(EMPTY_EMPHASIS, CHEST)).toBeNull();
  });

  it('distinguishes the region cap from the slot budget', () => {
    // Different remedies: one needs a region freed, the other a cheaper region.
    const threeCheap: EmphasisSelection = {
      priority: [BICEPS, TRICEPS, CALVES],
      deprioritized: [],
    };
    expect(prioritizeBlockedReason(threeCheap, CORE)).toBe('region-cap');

    const twoExpensive: EmphasisSelection = { priority: [CHEST, BACK], deprioritized: [] };
    expect(prioritizeBlockedReason(twoExpensive, QUADS)).toBe('slot-budget');
  });
});

describe('canDeprioritize', () => {
  it('allows unlimited maintenance regions', () => {
    const several: EmphasisSelection = {
      priority: [],
      deprioritized: [BICEPS, TRICEPS, CALVES],
    };
    expect(canDeprioritize(several, CORE)).toBe(true);
    expect(canDeprioritize(several, BICEPS)).toBe(true);
  });

  it('hides tibialis from the standard generator without deleting the domain region', () => {
    expect(GENERATOR_EMPHASIS_REGIONS).not.toContain(VolumeRegion.TIBIALIS);
    expect(GENERATOR_EMPHASIS_REGIONS).toContain(VolumeRegion.CALVES);
  });
});

describe('GENERATOR_EMPHASIS_GROUPS', () => {
  it('splits the control into Torso then Pierna without losing or duplicating a region', () => {
    expect(GENERATOR_EMPHASIS_GROUPS.map((group) => group.half)).toEqual(['UPPER', 'LOWER']);
    expect(GENERATOR_EMPHASIS_GROUPS.flatMap((group) => group.regions).sort())
      .toEqual([...GENERATOR_EMPHASIS_REGIONS].sort());
    expect(GENERATOR_EMPHASIS_GROUPS[1].regions).toEqual([
      VolumeRegion.QUADS, VolumeRegion.HAMSTRINGS, VolumeRegion.GLUTES,
      VolumeRegion.ADDUCTORS, VolumeRegion.CALVES,
    ]);
  });

  it('agrees with the muscle grouping used by the volume cards and session names', () => {
    for (const region of Object.values(VolumeRegion)) {
      if (region in MuscleGroup) {
        expect(regionBodyHalf(region)).toBe(bodyHalfOf(region as unknown as MuscleGroup));
      }
    }
    expect(regionBodyHalf(VolumeRegion.ERECTORS)).toBe('UPPER');
    expect(regionBodyHalf(VolumeRegion.CORE)).toBe('UPPER');
  });
});

describe('withChoice', () => {
  it('reports the current choice of a region', () => {
    const selection: EmphasisSelection = { priority: [CHEST], deprioritized: [CORE] };
    expect(choiceOf(selection, CHEST)).toBe('PRIORITY');
    expect(choiceOf(selection, CORE)).toBe('DEPRIORITIZED');
    expect(choiceOf(selection, BACK)).toBe('NORMAL');
  });

  it('MOVES a region between lists instead of leaving it in both', () => {
    // A contradiction the service would throw on must be impossible to build here.
    const prioritised = withChoice(EMPTY_EMPHASIS, CHEST, 'PRIORITY');
    const moved = withChoice(prioritised, CHEST, 'DEPRIORITIZED');
    expect(moved.priority).not.toContain(CHEST);
    expect(moved.deprioritized).toContain(CHEST);
  });

  it('clears back to normal', () => {
    const prioritised = withChoice(EMPTY_EMPHASIS, CHEST, 'PRIORITY');
    expect(withChoice(prioritised, CHEST, 'NORMAL')).toEqual(EMPTY_EMPHASIS);
  });

  it('returns the selection UNCHANGED when the priority does not fit', () => {
    const full: EmphasisSelection = { priority: [CHEST, BACK], deprioritized: [] };
    expect(withChoice(full, QUADS, 'PRIORITY')).toBe(full);
  });

  it('adds another maintenance region when several are already selected', () => {
    const several: EmphasisSelection = {
      priority: [],
      deprioritized: [BICEPS, TRICEPS, CALVES],
    };
    expect(withChoice(several, CORE, 'DEPRIORITIZED').deprioritized).toEqual([
      BICEPS,
      TRICEPS,
      CALVES,
      CORE,
    ]);
  });

  it('does not mutate the input', () => {
    const selection: EmphasisSelection = { priority: [], deprioritized: [] };
    withChoice(selection, CHEST, 'PRIORITY');
    expect(selection.priority).toEqual([]);
  });
});

describe('cycleChoice', () => {
  it('walks normal to priority to deprioritized and back', () => {
    let selection = EMPTY_EMPHASIS;
    selection = cycleChoice(selection, CHEST);
    expect(choiceOf(selection, CHEST)).toBe('PRIORITY');
    selection = cycleChoice(selection, CHEST);
    expect(choiceOf(selection, CHEST)).toBe('DEPRIORITIZED');
    selection = cycleChoice(selection, CHEST);
    expect(choiceOf(selection, CHEST)).toBe('NORMAL');
  });

  it('SKIPS priority when it does not fit, rather than blocking the cycle', () => {
    // Tapping a region whose priority is unaffordable should still let the athlete
    // deprioritise it.
    const full: EmphasisSelection = { priority: [CHEST, BACK], deprioritized: [] };
    const cycled = cycleChoice(full, QUADS);
    expect(choiceOf(cycled, QUADS)).toBe('DEPRIORITIZED');
  });

  it('skips a full priority state and still reaches maintenance', () => {
    const jammed: EmphasisSelection = {
      priority: [CHEST, BACK],
      deprioritized: [BICEPS, TRICEPS, CALVES],
    };
    expect(choiceOf(cycleChoice(jammed, QUADS), QUADS)).toBe('DEPRIORITIZED');
  });
});

describe('agreement with the service that throws', () => {
  it('every selection this module allows is one the service accepts', () => {
    // The two must not disagree: a screen that permits what the service rejects
    // would crash on generate.
    const regions = Object.values(VolumeRegion);
    let selection = EMPTY_EMPHASIS;
    regions.forEach((region) => {
      selection = cycleChoice(selection, region);
      expect(() => assertEmphasisLimits(selection.priority, selection.deprioritized)).not.toThrow();
    });
    regions.forEach((region) => {
      selection = cycleChoice(selection, region);
      expect(() => assertEmphasisLimits(selection.priority, selection.deprioritized)).not.toThrow();
    });
  });
});
