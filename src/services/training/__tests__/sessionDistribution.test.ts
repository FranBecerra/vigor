import {
  Equipment,
  ExerciseProfile,
  MovementVector,
  MuscleGroup,
  SplitStructure,
  type Exercise,
} from '@/models';
import { exerciseMinutes } from '@/services/training/trainingCapacity';
import {
  JUNK_VOLUME_SETS,
  LARGE_MUSCLE_SESSION_CAP,
  MULTI_PATTERN_ALLOWANCE,
  SMALL_MUSCLE_SESSION_CAP,
  appearanceSets,
  buildFocusSequence,
  distributeSelection,
  effectiveSetsByMuscle,
  sessionSetCap,
} from '@/services/training/sessionDistribution';

function exercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'exercise',
    name: 'Exercise',
    primaryMuscle: MuscleGroup.CHEST_MID_LOWER,
    secondaryMuscles: [],
    movementVector: MovementVector.PUSH_HORIZONTAL,
    profile: ExerciseProfile.COMPOUND_PRIMARY,
    equipment: Equipment.BARBELL,
    criteria: {
      stretchedPositionLoading: 3,
      rangeOfMotion: 3,
      resistanceProfileMatch: 3,
      stabilityCost: 3,
      loadProgressability: 3,
      systemicFatigueCost: 3,
    },
    isCustom: false,
    ...overrides,
  };
}

function distribute(
  split: SplitStructure,
  sessionsPerMicrocycle: number,
  selected = [{ exercise: exercise(), sets: 6 }],
) {
  return distributeSelection({ selection: { selected }, split, sessionsPerMicrocycle });
}

describe('distributeSelection — conservation and appearance limit', () => {
  it('preserves every set and splits six into two three-set appearances', () => {
    const result = distribute(SplitStructure.FULL_BODY, 2);

    expect(result.unassigned).toEqual([]);
    expect(result.sessions.map((session) => session.exercises[0]?.sets)).toEqual([3, 3]);
    expect(result.sessions.flatMap((session) => session.exercises).reduce((sum, entry) => sum + entry.sets, 0)).toBe(6);
  });

  it('calculates time with the same model as the capacity ceiling', () => {
    const result = distribute(SplitStructure.FULL_BODY, 1, [{ exercise: exercise(), sets: 3 }]);

    expect(result.sessions[0].estimatedWorkMinutes).toBeCloseTo(exerciseMinutes(exercise(), 3), 5);
    expect(result.totalWorkMinutes).toBeCloseTo(exerciseMinutes(exercise(), 3), 5);
    expect(result.maxSessionWorkMinutes).toBeCloseTo(result.totalWorkMinutes, 5);
  });

  it('is deterministic for the same selection', () => {
    expect(distribute(SplitStructure.FULL_BODY, 3)).toEqual(distribute(SplitStructure.FULL_BODY, 3));
  });
});

describe('distributeSelection — split semantics', () => {
  const chest = exercise({ id: 'chest' });
  const lats = exercise({
    id: 'lats',
    primaryMuscle: MuscleGroup.LATS,
    movementVector: MovementVector.PULL_VERTICAL,
  });
  const quads = exercise({
    id: 'quads',
    primaryMuscle: MuscleGroup.QUADS,
    movementVector: MovementVector.KNEE_DOMINANT,
  });
  const legPress = exercise({
    id: 'leg-press',
    primaryMuscle: MuscleGroup.QUADS,
    movementVector: MovementVector.KNEE_DOMINANT,
    profile: ExerciseProfile.COMPOUND_SECONDARY,
    secondaryMuscles: [MuscleGroup.GLUTES],
  });
  const squat = exercise({
    id: 'squat',
    primaryMuscle: MuscleGroup.QUADS,
    movementVector: MovementVector.KNEE_DOMINANT,
    secondaryMuscles: [MuscleGroup.GLUTES, MuscleGroup.ERECTORS],
  });
  const core = exercise({
    id: 'core',
    primaryMuscle: MuscleGroup.CORE,
    movementVector: MovementVector.CORE_ANTI_MOVEMENT,
    profile: ExerciseProfile.ISOLATION,
  });

  it('upper/lower separates upper and lower body', () => {
    const result = distribute(SplitStructure.UPPER_LOWER, 2, [
      { exercise: chest, sets: 3 },
      { exercise: quads, sets: 3 },
    ]);

    expect(result.sessions.map((session) => session.focus)).toEqual(['UPPER', 'LOWER']);
    expect(result.sessions[0].exercises.map((entry) => entry.exercise.id)).toEqual(['chest']);
    expect(result.sessions[1].exercises.map((entry) => entry.exercise.id)).toEqual(['quads']);
  });

  it('push/pull/legs places every exercise in its functional session', () => {
    const result = distribute(SplitStructure.PUSH_PULL_LEGS, 3, [
      { exercise: chest, sets: 3 },
      { exercise: lats, sets: 3 },
      { exercise: quads, sets: 3 },
    ]);

    expect(result.sessions.map((session) => session.exercises.map((entry) => entry.exercise.id))).toEqual([
      ['chest'],
      ['lats'],
      ['quads'],
    ]);
  });

  it('PPL+upper adds an upper session and assigns core to legs', () => {
    const result = distribute(SplitStructure.PUSH_PULL_LEGS_UPPER, 4, [
      { exercise: chest, sets: 6 },
      { exercise: core, sets: 3 },
    ]);

    expect(result.sessions.map((session) => session.focus)).toEqual(['PUSH', 'PULL', 'LEGS', 'UPPER']);
    expect(result.sessions[0].exercises.map((entry) => entry.exercise.id)).toEqual(['chest']);
    expect(result.sessions[2].exercises.map((entry) => entry.exercise.id)).toEqual(['core']);
    expect(result.sessions[3].exercises.map((entry) => entry.exercise.id)).toEqual(['chest']);
  });

  it('full body accepts every muscle in every session', () => {
    const result = distribute(SplitStructure.FULL_BODY, 1, [
      { exercise: chest, sets: 3 },
      { exercise: lats, sets: 3 },
      { exercise: quads, sets: 3 },
      { exercise: core, sets: 3 },
    ]);

    expect(result.sessions[0].exercises).toHaveLength(4);
  });

  it('avoids placing a planned squat immediately after a heavy leg press when another slot exists', () => {
    const result = distribute(SplitStructure.FULL_BODY, 3, [
      { exercise: legPress, sets: 3 },
      { exercise: squat, sets: 3 },
    ]);

    // What matters is the SEPARATION, not which of the two comes first.
    const positions = ['leg-press', 'squat'].map((id) =>
      result.sessions.findIndex((session) =>
        session.exercises.some((entry) => entry.exercise.id === id),
      ),
    );
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(Math.abs(positions[0] - positions[1])).toBeGreaterThan(1);
    expect(result.sequencingWarnings).toEqual([]);
  });

  it('reports an unavoidable overlap with the supplied previous session', () => {
    const result = distributeSelection({
      selection: { selected: [{ exercise: squat, sets: 3 }] },
      split: SplitStructure.FULL_BODY,
      sessionsPerMicrocycle: 1,
      previousSession: [{ exercise: legPress, sets: 3 }],
    });

    expect(result.sequencingWarnings).toEqual([
      expect.objectContaining({
        precedingSessionIndex: null,
        followingSessionIndex: 0,
        sharedMuscles: expect.arrayContaining([MuscleGroup.QUADS, MuscleGroup.GLUTES]),
        sharesMovementVector: true,
      }),
    ]);
  });
});

describe('distributeSelection — AUTO and edge cases', () => {
  // AUTO picks from structures that work in practice rather than cycling a
  // pattern: full body up to 3 sessions, upper/lower at 4, PPL + upper at 5
  // (which the extra-session rule turns into PPLUL), and PPL twice at 6.
  it.each([
    [1, SplitStructure.FULL_BODY],
    [2, SplitStructure.FULL_BODY],
    [3, SplitStructure.FULL_BODY],
    [4, SplitStructure.UPPER_LOWER],
    [5, SplitStructure.PUSH_PULL_LEGS_UPPER],
    [6, SplitStructure.PUSH_PULL_LEGS],
  ])('resolves AUTO with %i sessions', (sessions, expected) => {
    expect(distribute(SplitStructure.AUTO, sessions).resolvedSplit).toBe(expected);
  });

  it('does not silently lose work with no sessions: it reports it as unassigned', () => {
    const result = distribute(SplitStructure.AUTO, 0, [{ exercise: exercise(), sets: 3 }]);

    expect(result.sessions).toEqual([]);
    expect(result.unassigned).toEqual([{ exercise: exercise(), sets: 3 }]);
    expect(result.totalWorkMinutes).toBe(0);
    expect(result.maxSessionWorkMinutes).toBe(0);
  });
});

describe('distributeSelection — structure follows volume, not a cycled pattern', () => {
  /** Leg-heavy selection: the case that exposed the original throttling. */
  const legHeavy = [
    { exercise: exercise({ id: 'squat', primaryMuscle: MuscleGroup.QUADS, movementVector: MovementVector.KNEE_DOMINANT }), sets: 6 },
    { exercise: exercise({ id: 'rdl', primaryMuscle: MuscleGroup.HAMSTRINGS, movementVector: MovementVector.HIP_DOMINANT }), sets: 6 },
    { exercise: exercise({ id: 'hack', primaryMuscle: MuscleGroup.QUADS, movementVector: MovementVector.KNEE_DOMINANT }), sets: 6 },
    { exercise: exercise({ id: 'press', primaryMuscle: MuscleGroup.CHEST_MID_LOWER }), sets: 3 },
    { exercise: exercise({ id: 'row', primaryMuscle: MuscleGroup.LATS, movementVector: MovementVector.PULL_HORIZONTAL }), sets: 3 },
  ];

  it('gives a second leg day when leg volume needs one, instead of cycling', () => {
    // The old modulo pattern gave PUSH:2 PULL:2 LEGS:1 over five sessions, so all
    // leg work landed in one session and throttled the whole plan.
    const focuses = distributeSelection({
      selection: { selected: legHeavy },
      split: SplitStructure.PUSH_PULL_LEGS,
      sessionsPerMicrocycle: 5,
    }).sessions.map((session) => session.focus);

    expect(focuses.filter((focus) => focus === 'LEGS').length).toBeGreaterThanOrEqual(2);
  });

  it('NEVER leaves a session empty', () => {
    [3, 4, 5, 6].forEach((sessions) => {
      [
        SplitStructure.AUTO,
        SplitStructure.FULL_BODY,
        SplitStructure.UPPER_LOWER,
        SplitStructure.PUSH_PULL_LEGS,
        SplitStructure.PUSH_PULL_LEGS_UPPER,
      ].forEach((split) => {
        const result = distributeSelection({
          selection: { selected: legHeavy },
          split,
          sessionsPerMicrocycle: sessions,
        });
        // Only genuinely impossible with fewer appearances than sessions.
        const appearances = result.sessions.reduce(
          (sum, session) => sum + session.exercises.length,
          0,
        );
        if (appearances >= sessions) {
          result.sessions.forEach((session) =>
            expect(session.exercises.length).toBeGreaterThan(0),
          );
          expect(result.structureWarnings.some((warning) => warning.kind === 'empty-session')).toBe(
            false,
          );
        }
      });
    });
  });

  it('SPILLS work to a mismatched focus rather than overflowing a session cap', () => {
    // The athlete's own point: some leg volume can go into a push day. Saturating
    // the one leg day instead would make the capacity search cut the whole plan.
    const result = distributeSelection({
      selection: { selected: legHeavy },
      split: SplitStructure.PUSH_PULL_LEGS_UPPER,
      sessionsPerMicrocycle: 4,
      maxWorkMinutesPerSession: 30,
    });

    result.sessions.forEach((session) =>
      expect(session.estimatedWorkMinutes).toBeLessThanOrEqual(30),
    );
  });

  it('keeps the split recognisable when no session is under pressure', () => {
    // With a generous cap the mismatch cost dominates and work stays in its focus.
    const result = distributeSelection({
      selection: { selected: legHeavy },
      split: SplitStructure.UPPER_LOWER,
      sessionsPerMicrocycle: 4,
      maxWorkMinutesPerSession: 500,
    });
    const upper = result.sessions.filter((session) => session.focus === 'UPPER');
    upper.forEach((session) =>
      session.exercises.forEach((entry) =>
        expect([MuscleGroup.CHEST_MID_LOWER, MuscleGroup.LATS]).toContain(
          entry.exercise.primaryMuscle,
        ),
      ),
    );
  });

  it('equalises session load in MINUTES, not in sets', () => {
    // A compound set costs more time than an isolation set, so equal minutes means
    // a compound-heavy session fits fewer sets per minute. That is the intended
    // behaviour: similar load per day, with the demanding days carrying less work.
    const mixed = [
      { exercise: exercise({ id: 'squat', primaryMuscle: MuscleGroup.QUADS, movementVector: MovementVector.KNEE_DOMINANT }), sets: 6 },
      { exercise: exercise({ id: 'rdl', primaryMuscle: MuscleGroup.HAMSTRINGS, movementVector: MovementVector.HIP_DOMINANT }), sets: 6 },
      { exercise: exercise({ id: 'press', primaryMuscle: MuscleGroup.CHEST_UPPER }), sets: 6 },
      { exercise: exercise({ id: 'curl', primaryMuscle: MuscleGroup.BICEPS, movementVector: MovementVector.ELBOW_FLEXION, profile: ExerciseProfile.ISOLATION }), sets: 6 },
      { exercise: exercise({ id: 'lateral', primaryMuscle: MuscleGroup.DELTS_LATERAL, movementVector: MovementVector.SHOULDER_ABDUCTION, profile: ExerciseProfile.ISOLATION }), sets: 6 },
      { exercise: exercise({ id: 'fly', primaryMuscle: MuscleGroup.CHEST_MID_LOWER, movementVector: MovementVector.SHOULDER_HORIZONTAL_ADDUCTION, profile: ExerciseProfile.ISOLATION }), sets: 6 },
    ];
    const result = distributeSelection({
      selection: { selected: mixed },
      split: SplitStructure.FULL_BODY,
      sessionsPerMicrocycle: 4,
    });

    expect(result.structureWarnings.some((warning) => warning.kind === 'unbalanced-load')).toBe(
      false,
    );

    const density = result.sessions.map((session) => ({
      compoundSets: session.exercises
        .filter((entry) => entry.exercise.profile !== ExerciseProfile.ISOLATION)
        .reduce((sum, entry) => sum + entry.sets, 0),
      setsPerMinute:
        session.exercises.reduce((sum, entry) => sum + entry.sets, 0) /
        session.estimatedWorkMinutes,
    }));
    const heaviest = density.reduce((best, item) =>
      item.compoundSets > best.compoundSets ? item : best,
    );
    const lightest = density.reduce((best, item) =>
      item.compoundSets < best.compoundSets ? item : best,
    );
    expect(heaviest.setsPerMinute).toBeLessThan(lightest.setsPerMinute);
  });
});

describe('distributeSelection — frequency target', () => {
  const fourSets = [
    { exercise: exercise({ id: 'press', primaryMuscle: MuscleGroup.CHEST_MID_LOWER }), sets: 4 },
  ];

  it('splits four sets as 2 + 2 to reach frequency 2, not 3 + 1', () => {
    // A one-set appearance costs a full setup for almost no stimulus.
    const result = distributeSelection({
      selection: { selected: fourSets },
      split: SplitStructure.FULL_BODY,
      sessionsPerMicrocycle: 2,
    });
    expect(result.sessions.map((session) => session.exercises[0]?.sets).sort()).toEqual([2, 2]);
    expect(result.frequencyByMuscle[MuscleGroup.CHEST_MID_LOWER]).toBe(2);
  });

  it('three sets stay in ONE appearance: a 2 + 1 split would waste a setup', () => {
    const result = distributeSelection({
      selection: {
        selected: [
          { exercise: exercise({ id: 'press', primaryMuscle: MuscleGroup.CHEST_MID_LOWER }), sets: 3 },
        ],
      },
      split: SplitStructure.FULL_BODY,
      sessionsPerMicrocycle: 2,
    });
    expect(result.frequencyByMuscle[MuscleGroup.CHEST_MID_LOWER]).toBe(1);
  });

  it('does not warn about a DEPRIORITIZED muscle trained once', () => {
    // Deprioritization exempts from the frequency REPORT. It cannot override the
    // appearance cap, which is what splits four or more sets in the first place.
    const result = distributeSelection({
      selection: {
        selected: [
          { exercise: exercise({ id: 'press', primaryMuscle: MuscleGroup.CHEST_MID_LOWER }), sets: 3 },
        ],
      },
      split: SplitStructure.FULL_BODY,
      sessionsPerMicrocycle: 2,
      deprioritizedMuscles: [MuscleGroup.CHEST_MID_LOWER],
    });
    expect(result.structureWarnings.some((warning) => warning.kind === 'single-frequency')).toBe(
      false,
    );
  });

  it('WARNS when a non-deprioritized muscle ends up at frequency 1', () => {
    const result = distributeSelection({
      selection: {
        selected: [
          { exercise: exercise({ id: 'press', primaryMuscle: MuscleGroup.CHEST_MID_LOWER }), sets: 3 },
        ],
      },
      split: SplitStructure.FULL_BODY,
      sessionsPerMicrocycle: 2,
    });
    expect(
      result.structureWarnings.some(
        (warning) =>
          warning.kind === 'single-frequency' && warning.muscle === MuscleGroup.CHEST_MID_LOWER,
      ),
    ).toBe(true);
  });

  it('never warns about frequency with a single session', () => {
    const result = distributeSelection({
      selection: { selected: fourSets },
      split: SplitStructure.FULL_BODY,
      sessionsPerMicrocycle: 1,
    });
    expect(result.structureWarnings.some((warning) => warning.kind === 'single-frequency')).toBe(
      false,
    );
  });
});

describe('appearanceSets', () => {
  it('splits evenly rather than filling the cap first', () => {
    expect(appearanceSets(4, 4)).toEqual([2, 2]);
    expect(appearanceSets(6, 4)).toEqual([3, 3]);
    expect(appearanceSets(7, 4)).toEqual([3, 2, 2]);
  });

  it('keeps a small prescription in one appearance', () => {
    expect(appearanceSets(3, 4)).toEqual([3]);
    expect(appearanceSets(1, 4)).toEqual([1]);
  });

  it('always sums to the prescribed sets, so volume is conserved', () => {
    for (let sets = 1; sets <= 20; sets += 1) {
      for (let sessions = 1; sessions <= 6; sessions += 1) {
        const chunks = appearanceSets(sets, sessions);
        expect(chunks.reduce((sum, value) => sum + value, 0)).toBe(sets);
        expect(chunks.length).toBeLessThanOrEqual(sessions);
      }
    }
  });

  it('SPREADS the excess when there are fewer sessions than needed appearances', () => {
    // Exceeding the cap is unavoidable here; dumping it all on the last appearance
    // would be worse than spreading it.
    expect(appearanceSets(9, 2)).toEqual([5, 4]);
    expect(appearanceSets(6, 1)).toEqual([6]);
  });

  it('returns nothing for empty input', () => {
    expect(appearanceSets(0, 3)).toEqual([]);
    expect(appearanceSets(-2, 3)).toEqual([]);
    expect(appearanceSets(5, 0)).toEqual([]);
  });
});

describe('buildFocusSequence', () => {
  const legMinutes = new Map<MuscleGroup, number>([
    [MuscleGroup.QUADS, 60],
    [MuscleGroup.HAMSTRINGS, 40],
    [MuscleGroup.CHEST_MID_LOWER, 20],
    [MuscleGroup.LATS, 20],
  ]);

  it('gives the extra session to the focus carrying the most unplaced work', () => {
    const sequence = buildFocusSequence(SplitStructure.PUSH_PULL_LEGS, 4, legMinutes);
    expect(sequence.filter((focus) => focus === 'LEGS').length).toBe(2);
  });

  it('turns PPL + upper over five sessions into the PPLUL structure', () => {
    const sequence = buildFocusSequence(SplitStructure.PUSH_PULL_LEGS_UPPER, 5, legMinutes);
    expect(new Set(sequence)).toEqual(new Set(['PUSH', 'PULL', 'LEGS', 'UPPER', 'LOWER']));
  });

  it('does NOT place the same focus back to back when a swap exists', () => {
    // Balanced work on purpose: with lopsided volume the extra sessions all go to
    // one focus and adjacency is unavoidable, which is the correct outcome there.
    const balanced = new Map<MuscleGroup, number>([
      [MuscleGroup.QUADS, 50],
      [MuscleGroup.CHEST_MID_LOWER, 25],
      [MuscleGroup.LATS, 25],
    ]);
    const sequence = buildFocusSequence(SplitStructure.UPPER_LOWER, 4, balanced);
    expect(sequence.filter((focus) => focus === 'LOWER').length).toBe(2);
    for (let index = 1; index < sequence.length; index += 1) {
      expect(sequence[index]).not.toBe(sequence[index - 1]);
    }
  });

  it('accepts unavoidable adjacency when one focus carries most of the work', () => {
    // Three leg days for one upper day is what a 2.5-to-1 volume split implies.
    const sequence = buildFocusSequence(SplitStructure.UPPER_LOWER, 4, legMinutes);
    expect(sequence.filter((focus) => focus === 'LOWER').length).toBe(3);
  });

  it('repeats the only available focus when the split has just one', () => {
    expect(buildFocusSequence(SplitStructure.FULL_BODY, 3, legMinutes)).toEqual([
      'FULL_BODY',
      'FULL_BODY',
      'FULL_BODY',
    ]);
  });

  it('returns nothing without sessions', () => {
    expect(buildFocusSequence(SplitStructure.FULL_BODY, 0, legMinutes)).toEqual([]);
    expect(buildFocusSequence(SplitStructure.FULL_BODY, -1, legMinutes)).toEqual([]);
  });
});

describe('effectiveSetsByMuscle', () => {
  it('counts a direct set as 1 and a secondary credit as 0.5', () => {
    const press = exercise({
      id: 'press',
      primaryMuscle: MuscleGroup.CHEST_MID_LOWER,
      secondaryMuscles: [MuscleGroup.TRICEPS, MuscleGroup.DELTS_FRONT],
    });
    const totals = effectiveSetsByMuscle([{ exercise: press, sets: 4 }]);

    expect(totals.get(MuscleGroup.CHEST_MID_LOWER)).toBe(4);
    expect(totals.get(MuscleGroup.TRICEPS)).toBe(2);
    expect(totals.get(MuscleGroup.DELTS_FRONT)).toBe(2);
  });

  it('accumulates across exercises', () => {
    const totals = effectiveSetsByMuscle([
      { exercise: exercise({ id: 'a', primaryMuscle: MuscleGroup.TRICEPS }), sets: 3 },
      {
        exercise: exercise({
          id: 'b',
          primaryMuscle: MuscleGroup.CHEST_MID_LOWER,
          secondaryMuscles: [MuscleGroup.TRICEPS],
        }),
        sets: 4,
      },
    ]);
    expect(totals.get(MuscleGroup.TRICEPS)).toBe(5);
  });

  it('is empty for an empty session', () => {
    expect(effectiveSetsByMuscle([]).size).toBe(0);
  });
});

describe('sessionSetCap', () => {
  const squat = exercise({
    id: 'squat',
    primaryMuscle: MuscleGroup.QUADS,
    movementVector: MovementVector.KNEE_DOMINANT,
  });
  const extension = exercise({
    id: 'extension',
    primaryMuscle: MuscleGroup.QUADS,
    movementVector: MovementVector.KNEE_EXTENSION,
    profile: ExerciseProfile.ISOLATION,
  });

  it('caps a single-joint muscle lower, because it fatigues fast and gets indirect work', () => {
    expect(sessionSetCap(MuscleGroup.BICEPS, [])).toBe(SMALL_MUSCLE_SESSION_CAP);
    expect(sessionSetCap(MuscleGroup.TRICEPS, [])).toBe(SMALL_MUSCLE_SESSION_CAP);
    expect(sessionSetCap(MuscleGroup.DELTS_LATERAL, [])).toBe(SMALL_MUSCLE_SESSION_CAP);
  });

  it('caps a large muscle at the productive ceiling with a single pattern', () => {
    expect(sessionSetCap(MuscleGroup.QUADS, [{ exercise: squat, sets: 3 }])).toBe(
      LARGE_MUSCLE_SESSION_CAP,
    );
  });

  it('allows more for a large muscle trained through TWO distinct patterns', () => {
    const cap = sessionSetCap(MuscleGroup.QUADS, [
      { exercise: squat, sets: 3 },
      { exercise: extension, sets: 3 },
    ]);
    expect(cap).toBe(LARGE_MUSCLE_SESSION_CAP + MULTI_PATTERN_ALLOWANCE);
  });

  it('NEVER exceeds the junk-volume ceiling', () => {
    Object.values(MuscleGroup).forEach((muscle) => {
      expect(
        sessionSetCap(muscle, [
          { exercise: squat, sets: 3 },
          { exercise: extension, sets: 3 },
        ]),
      ).toBeLessThanOrEqual(JUNK_VOLUME_SETS);
    });
  });
});

describe('distributeSelection — per-session muscle volume cap', () => {
  /** 18 weekly sets of one muscle: far past what a single session can absorb. */
  const highVolume = [
    { exercise: exercise({ id: 'squat', primaryMuscle: MuscleGroup.QUADS, movementVector: MovementVector.KNEE_DOMINANT }), sets: 6 },
    { exercise: exercise({ id: 'hack', primaryMuscle: MuscleGroup.QUADS, movementVector: MovementVector.KNEE_DOMINANT }), sets: 6 },
    { exercise: exercise({ id: 'extension', primaryMuscle: MuscleGroup.QUADS, movementVector: MovementVector.KNEE_EXTENSION, profile: ExerciseProfile.ISOLATION }), sets: 6 },
  ];

  it('FORCES frequency 2 or 3 rather than piling weekly volume into one session', () => {
    // Two sessions of 8 beat one of 16: past the ceiling the last sets are junk.
    const result = distributeSelection({
      selection: { selected: highVolume },
      split: SplitStructure.FULL_BODY,
      sessionsPerMicrocycle: 3,
    });

    result.sessions.forEach((session) => {
      effectiveSetsByMuscle(session.exercises).forEach((effective, muscle) => {
        expect(effective).toBeLessThanOrEqual(sessionSetCap(muscle, session.exercises));
      });
    });
    expect(result.frequencyByMuscle[MuscleGroup.QUADS]).toBeGreaterThanOrEqual(2);
  });

  it('conserves every set while respecting the cap', () => {
    const result = distributeSelection({
      selection: { selected: highVolume },
      split: SplitStructure.FULL_BODY,
      sessionsPerMicrocycle: 3,
    });
    const placed = result.sessions
      .flatMap((session) => session.exercises)
      .reduce((sum, entry) => sum + entry.sets, 0);
    expect(placed).toBe(18);
    expect(result.unassigned).toEqual([]);
  });

  it('INDIRECT work eats into the direct budget of a synergist', () => {
    // Heavy pressing already gives the triceps half a set per set performed.
    const result = distributeSelection({
      selection: {
        selected: [
          {
            exercise: exercise({
              id: 'bench',
              primaryMuscle: MuscleGroup.CHEST_MID_LOWER,
              secondaryMuscles: [MuscleGroup.TRICEPS],
            }),
            sets: 6,
          },
          {
            exercise: exercise({
              id: 'ohp',
              primaryMuscle: MuscleGroup.DELTS_FRONT,
              secondaryMuscles: [MuscleGroup.TRICEPS],
              movementVector: MovementVector.PUSH_VERTICAL,
            }),
            sets: 6,
          },
          {
            exercise: exercise({
              id: 'pushdown',
              primaryMuscle: MuscleGroup.TRICEPS,
              movementVector: MovementVector.ELBOW_EXTENSION,
              profile: ExerciseProfile.ISOLATION,
            }),
            sets: 6,
          },
        ],
      },
      split: SplitStructure.FULL_BODY,
      sessionsPerMicrocycle: 3,
    });

    result.sessions.forEach((session) => {
      const triceps = effectiveSetsByMuscle(session.exercises).get(MuscleGroup.TRICEPS) ?? 0;
      expect(triceps).toBeLessThanOrEqual(SMALL_MUSCLE_SESSION_CAP);
    });
  });

  it('WARNS instead of cutting when the split leaves nowhere else for the work', () => {
    // One session cannot hold 18 sets of one muscle. The volume is kept and the
    // trade-off is reported, never silently deleted.
    const result = distributeSelection({
      selection: { selected: highVolume },
      split: SplitStructure.FULL_BODY,
      sessionsPerMicrocycle: 1,
    });

    expect(
      result.sessions.flatMap((s) => s.exercises).reduce((sum, e) => sum + e.sets, 0),
    ).toBe(18);
    expect(
      result.structureWarnings.some(
        (warning) =>
          warning.kind === 'session-volume-cap' && warning.muscle === MuscleGroup.QUADS,
      ),
    ).toBe(true);
  });
});

describe('distributeSelection — work with no matching focus', () => {
  it('still places work when NO session focus accepts its muscle', () => {
    // PPL over two sessions yields PUSH and PULL only, so leg work has no natural
    // home. Losing it silently would be worse than paying the mismatch.
    const result = distributeSelection({
      selection: {
        selected: [
          {
            exercise: exercise({
              id: 'squat',
              primaryMuscle: MuscleGroup.QUADS,
              movementVector: MovementVector.KNEE_DOMINANT,
            }),
            sets: 6,
          },
        ],
      },
      split: SplitStructure.PUSH_PULL_LEGS,
      sessionsPerMicrocycle: 2,
    });

    expect(result.sessions.map((session) => session.focus)).toEqual(['PUSH', 'PULL']);
    expect(
      result.sessions.flatMap((s) => s.exercises).reduce((sum, e) => sum + e.sets, 0),
    ).toBe(6);
    expect(result.unassigned).toEqual([]);
  });
});

describe('distributeSelection — empty-session repair', () => {
  it('MOVES an appearance into a session the cost function left empty', () => {
    // Chest work only matches PUSH, so PULL and LEGS start empty. The repair is
    // deterministic rather than left to the cost function.
    const result = distributeSelection({
      selection: {
        selected: [
          { exercise: exercise({ id: 'bench', primaryMuscle: MuscleGroup.CHEST_MID_LOWER }), sets: 3 },
          {
            // Lighter than the press, so the repair has a clear least-fatiguing
            // appearance to move rather than an arbitrary tie.
            exercise: exercise({
              id: 'fly',
              primaryMuscle: MuscleGroup.CHEST_MID_LOWER,
              movementVector: MovementVector.SHOULDER_HORIZONTAL_ADDUCTION,
              profile: ExerciseProfile.ISOLATION,
            }),
            sets: 3,
          },
        ],
      },
      split: SplitStructure.PUSH_PULL_LEGS,
      sessionsPerMicrocycle: 3,
    });

    const filled = result.sessions.filter((session) => session.exercises.length > 0).length;
    expect(filled).toBeGreaterThan(1);
    expect(
      result.sessions.flatMap((s) => s.exercises).reduce((sum, e) => sum + e.sets, 0),
    ).toBe(6);
  });

  it('reports an empty session it cannot repair, with fewer appearances than sessions', () => {
    const result = distributeSelection({
      selection: {
        selected: [
          { exercise: exercise({ id: 'bench', primaryMuscle: MuscleGroup.CHEST_MID_LOWER }), sets: 3 },
        ],
      },
      split: SplitStructure.PUSH_PULL_LEGS,
      sessionsPerMicrocycle: 3,
    });

    expect(result.structureWarnings.some((warning) => warning.kind === 'empty-session')).toBe(true);
  });
});

describe('distributeSelection — fewer appearances than sessions', () => {
  it('keeps all the work and reports the session it cannot fill', () => {
    // Two appearances cannot fill three sessions. Volume is conserved and the gap
    // is reported rather than padded with filler sets.
    const result = distributeSelection({
      selection: {
        selected: [
          { exercise: exercise({ id: 'bench', primaryMuscle: MuscleGroup.CHEST_MID_LOWER }), sets: 3 },
          {
            exercise: exercise({
              id: 'curl',
              primaryMuscle: MuscleGroup.BICEPS,
              movementVector: MovementVector.ELBOW_FLEXION,
              profile: ExerciseProfile.ISOLATION,
            }),
            sets: 3,
          },
        ],
      },
      split: SplitStructure.FULL_BODY,
      sessionsPerMicrocycle: 3,
    });

    expect(result.sessions.filter((session) => session.exercises.length > 0).length).toBe(2);
    expect(
      result.sessions.flatMap((s) => s.exercises).reduce((sum, e) => sum + e.sets, 0),
    ).toBe(6);
    expect(result.structureWarnings.some((warning) => warning.kind === 'empty-session')).toBe(true);
  });
});
