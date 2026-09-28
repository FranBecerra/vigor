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
  canonicalPplFocuses,
  distributeSelection,
  effectiveSetsByMuscle,
  isSessionAnchor,
  matchingMoveForEmpty,
  orderSessionExercises,
  sessionSetCap,
} from '@/services/training/sessionDistribution';

describe('orderSessionExercises', () => {
  it('starts with a three-set compound and leaves isolation work last', () => {
    const ordered = orderSessionExercises([
      { exercise: exercise({ id: 'curl', profile: ExerciseProfile.ISOLATION }), sets: 4 },
      {
        exercise: exercise({ id: 'two-set-primary', profile: ExerciseProfile.COMPOUND_PRIMARY }),
        sets: 2,
      },
      {
        exercise: exercise({ id: 'anchor', profile: ExerciseProfile.COMPOUND_SECONDARY }),
        sets: 3,
      },
    ]);
    expect(ordered.map((entry) => entry.exercise.id)).toEqual([
      'anchor',
      'two-set-primary',
      'curl',
    ]);
  });

  it('does not treat an accessory compound as the main session anchor', () => {
    expect(
      isSessionAnchor({
        exercise: exercise({
          movementVector: MovementVector.SHOULDER_ABDUCTION,
          profile: ExerciseProfile.COMPOUND_SECONDARY,
        }),
        sets: 6,
      }),
    ).toBe(false);
    expect(
      isSessionAnchor({
        exercise: exercise({ movementVector: MovementVector.PULL_HORIZONTAL }),
        sets: 3,
      }),
    ).toBe(true);
  });

  it('prefers primary compounds, then more sets, then higher fatigue and a stable id', () => {
    const ordered = orderSessionExercises([
      { exercise: exercise({ id: 'b', profile: ExerciseProfile.COMPOUND_SECONDARY }), sets: 3 },
      { exercise: exercise({ id: 'a', profile: ExerciseProfile.COMPOUND_PRIMARY }), sets: 3 },
      { exercise: exercise({ id: 'c', profile: ExerciseProfile.COMPOUND_PRIMARY }), sets: 4 },
    ]);
    expect(ordered.map((entry) => entry.exercise.id)).toEqual(['c', 'a', 'b']);
  });
});

function exercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'exercise',
    name: 'Exercise',
    primaryMuscle: MuscleGroup.CHEST,
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

describe('distributeSelection — conservation and exercise uniqueness', () => {
  it('finds a donor exercise that belongs to an empty focus', () => {
    const donor = {
      index: 0,
      focus: 'PUSH' as const,
      exercises: [{ exercise: exercise({ primaryMuscle: MuscleGroup.CHEST }), sets: 3 }],
      estimatedWorkMinutes: 10,
    };
    expect(matchingMoveForEmpty('PUSH', [donor])).toEqual({
      donor,
      entry: donor.exercises[0],
    });
  });

  it('preserves every set and keeps an exercise in one session', () => {
    const result = distribute(SplitStructure.FULL_BODY, 2);

    expect(result.unassigned).toEqual([]);
    expect(result.sessions.flatMap((session) => session.exercises)).toHaveLength(1);
    expect(result.sessions.flatMap((session) => session.exercises)[0].sets).toBe(6);
    expect(result.sessions.flatMap((session) => session.exercises).reduce((sum, entry) => sum + entry.sets, 0)).toBe(6);
  });

  it('never repeats one exercise across the microcycle', () => {
    const result = distribute(SplitStructure.PUSH_PULL_LEGS_UPPER, 5, [
      {
        exercise: exercise({
          id: 'curl',
          primaryMuscle: MuscleGroup.BICEPS,
          movementVector: MovementVector.ELBOW_FLEXION,
          profile: ExerciseProfile.ISOLATION,
        }),
        sets: 5,
      },
    ]);

    expect(
      result.sessions.flatMap((session) => session.exercises).filter((entry) => entry.exercise.id === 'curl'),
    ).toHaveLength(1);
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
      { exercise: chest, sets: 3 },
      { exercise: exercise({ id: 'upper-chest', primaryMuscle: MuscleGroup.CHEST }), sets: 3 },
      { exercise: core, sets: 3 },
    ]);

    expect(result.sessions.map((session) => session.focus)).toEqual(['PUSH', 'PULL', 'LEGS', 'UPPER']);
    expect(result.sessions[0].exercises.map((entry) => entry.exercise.id)).toEqual(['chest']);
    expect(result.sessions[2].exercises.map((entry) => entry.exercise.id)).toEqual(['core']);
    expect(result.sessions[3].exercises.map((entry) => entry.exercise.id)).toEqual(['upper-chest']);
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
  // AUTO keeps freedom to select and expand the split that best absorbs volume.
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

  it('adapts the fifth focus to the volume instead of enforcing manual PPLUL', () => {
    const upperHeavy = new Map<MuscleGroup, number>([
      [MuscleGroup.CHEST, 80],
      [MuscleGroup.LATS, 70],
      [MuscleGroup.QUADS, 10],
    ]);
    expect(
      buildFocusSequence(
        SplitStructure.PUSH_PULL_LEGS_UPPER,
        5,
        upperHeavy,
        false,
      ),
    ).toEqual(['PUSH', 'PULL', 'LEGS', 'UPPER', 'PUSH']);
  });

  it('wires the adaptive focus sequence into AUTO distribution', () => {
    const result = distributeSelection({
      selection: {
        selected: [
          { exercise: exercise({ id: 'chest' }), sets: 20 },
          {
            exercise: exercise({
              id: 'lats',
              primaryMuscle: MuscleGroup.LATS,
              movementVector: MovementVector.PULL_VERTICAL,
            }),
            sets: 15,
          },
          {
            exercise: exercise({
              id: 'quads',
              primaryMuscle: MuscleGroup.QUADS,
              movementVector: MovementVector.KNEE_DOMINANT,
            }),
            sets: 3,
          },
        ],
      },
      split: SplitStructure.AUTO,
      sessionsPerMicrocycle: 5,
    });
    expect(result.sessions.map((session) => session.focus)).toEqual([
      'PUSH',
      'PULL',
      'LEGS',
      'UPPER',
      'PUSH',
    ]);
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
    { exercise: exercise({ id: 'press', primaryMuscle: MuscleGroup.CHEST }), sets: 3 },
    { exercise: exercise({ id: 'row', primaryMuscle: MuscleGroup.LATS, movementVector: MovementVector.PULL_HORIZONTAL }), sets: 3 },
  ];

  it('keeps the requested canonical focus sequence', () => {
    const focuses = distributeSelection({
      selection: { selected: legHeavy },
      split: SplitStructure.PUSH_PULL_LEGS,
      sessionsPerMicrocycle: 5,
    }).sessions.map((session) => session.focus);

    expect(focuses).toEqual(['PUSH', 'PULL', 'LEGS', 'UPPER', 'LOWER']);
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
        expect([MuscleGroup.CHEST, MuscleGroup.LATS]).toContain(
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
      { exercise: exercise({ id: 'press', primaryMuscle: MuscleGroup.CHEST }), sets: 6 },
      { exercise: exercise({ id: 'curl', primaryMuscle: MuscleGroup.BICEPS, movementVector: MovementVector.ELBOW_FLEXION, profile: ExerciseProfile.ISOLATION }), sets: 6 },
      { exercise: exercise({ id: 'lateral', primaryMuscle: MuscleGroup.DELTS_LATERAL, movementVector: MovementVector.SHOULDER_ABDUCTION, profile: ExerciseProfile.ISOLATION }), sets: 6 },
      { exercise: exercise({ id: 'fly', primaryMuscle: MuscleGroup.CHEST, movementVector: MovementVector.SHOULDER_HORIZONTAL_ADDUCTION, profile: ExerciseProfile.ISOLATION }), sets: 6 },
      { exercise: exercise({ id: 'triceps', primaryMuscle: MuscleGroup.TRICEPS, movementVector: MovementVector.ELBOW_EXTENSION, profile: ExerciseProfile.ISOLATION }), sets: 6 },
      { exercise: exercise({ id: 'row', primaryMuscle: MuscleGroup.LATS, movementVector: MovementVector.PULL_HORIZONTAL }), sets: 6 },
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
    expect(heaviest.setsPerMinute).toBeLessThanOrEqual(lightest.setsPerMinute);
  });

  it('uses both leg sessions instead of piling the lower-body work into one', () => {
    const lowerBody = [
      {
        exercise: exercise({ id: 'press' }),
        sets: 6,
      },
      {
        exercise: exercise({
          id: 'pulldown',
          primaryMuscle: MuscleGroup.LATS,
          movementVector: MovementVector.PULL_VERTICAL,
        }),
        sets: 6,
      },
      {
        exercise: exercise({
          id: 'squat',
          primaryMuscle: MuscleGroup.QUADS,
          movementVector: MovementVector.KNEE_DOMINANT,
        }),
        sets: 3,
      },
      {
        exercise: exercise({
          id: 'rdl',
          primaryMuscle: MuscleGroup.HAMSTRINGS,
          movementVector: MovementVector.HIP_DOMINANT,
        }),
        sets: 3,
      },
      {
        exercise: exercise({
          id: 'leg-extension',
          primaryMuscle: MuscleGroup.QUADS,
          movementVector: MovementVector.KNEE_EXTENSION,
          profile: ExerciseProfile.ISOLATION,
        }),
        sets: 3,
      },
      {
        exercise: exercise({
          id: 'leg-curl',
          primaryMuscle: MuscleGroup.HAMSTRINGS,
          movementVector: MovementVector.KNEE_FLEXION,
          profile: ExerciseProfile.ISOLATION,
        }),
        sets: 3,
      },
    ];
    const result = distributeSelection({
      selection: { selected: lowerBody },
      split: SplitStructure.PUSH_PULL_LEGS_UPPER,
      sessionsPerMicrocycle: 5,
      maxWorkMinutesPerSession: 59,
    });
    const legSessions = result.sessions.filter(
      (session) => session.focus === 'LEGS' || session.focus === 'LOWER',
    );

    expect(legSessions).toHaveLength(2);
    legSessions.forEach((session) => expect(session.exercises.length).toBeGreaterThan(0));
    const placedIds = result.sessions.flatMap((session) =>
      session.exercises.map((entry) => entry.exercise.id),
    );
    expect(new Set(placedIds).size).toBe(lowerBody.length);
  });
});

describe('distributeSelection — frequency target', () => {
  const fourSetsAcrossVariants = [
    { exercise: exercise({ id: 'press', primaryMuscle: MuscleGroup.CHEST }), sets: 2 },
    { exercise: exercise({ id: 'machine-press', primaryMuscle: MuscleGroup.CHEST, equipment: Equipment.MACHINE }), sets: 2 },
  ];

  it('uses two distinct variants to reach frequency 2', () => {
    const result = distributeSelection({
      selection: { selected: fourSetsAcrossVariants },
      split: SplitStructure.FULL_BODY,
      sessionsPerMicrocycle: 2,
    });
    expect(result.sessions.map((session) => session.exercises[0]?.sets).sort()).toEqual([2, 2]);
    expect(result.frequencyByMuscle[MuscleGroup.CHEST]).toBe(2);
    const ids = result.sessions.flatMap((session) => session.exercises.map((entry) => entry.exercise.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('three sets stay in ONE appearance: a 2 + 1 split would waste a setup', () => {
    const result = distributeSelection({
      selection: {
        selected: [
          { exercise: exercise({ id: 'press', primaryMuscle: MuscleGroup.CHEST }), sets: 3 },
        ],
      },
      split: SplitStructure.FULL_BODY,
      sessionsPerMicrocycle: 2,
    });
    expect(result.frequencyByMuscle[MuscleGroup.CHEST]).toBe(1);
  });

  it('does not warn about a DEPRIORITIZED muscle trained once', () => {
    // Deprioritization exempts from the frequency REPORT. It cannot override the
    // appearance cap, which is what splits four or more sets in the first place.
    const result = distributeSelection({
      selection: {
        selected: [
          { exercise: exercise({ id: 'press', primaryMuscle: MuscleGroup.CHEST }), sets: 3 },
        ],
      },
      split: SplitStructure.FULL_BODY,
      sessionsPerMicrocycle: 2,
      deprioritizedMuscles: [MuscleGroup.CHEST],
    });
    expect(result.structureWarnings.some((warning) => warning.kind === 'single-frequency')).toBe(
      false,
    );
  });

  it('WARNS when a non-deprioritized muscle ends up at frequency 1', () => {
    const result = distributeSelection({
      selection: {
        selected: [
          { exercise: exercise({ id: 'press', primaryMuscle: MuscleGroup.CHEST }), sets: 3 },
        ],
      },
      split: SplitStructure.FULL_BODY,
      sessionsPerMicrocycle: 2,
    });
    expect(
      result.structureWarnings.some(
        (warning) =>
          warning.kind === 'single-frequency' && warning.muscle === MuscleGroup.CHEST,
      ),
    ).toBe(true);
  });

  it('never warns about frequency with a single session', () => {
    const result = distributeSelection({
      selection: { selected: fourSetsAcrossVariants },
      split: SplitStructure.FULL_BODY,
      sessionsPerMicrocycle: 1,
    });
    expect(result.structureWarnings.some((warning) => warning.kind === 'single-frequency')).toBe(
      false,
    );
  });
});

describe('appearanceSets', () => {
  it('keeps every valid prescription in one appearance', () => {
    expect(appearanceSets(4, 4)).toEqual([4]);
    expect(appearanceSets(6, 4)).toEqual([6]);
    expect(appearanceSets(7, 4)).toEqual([7]);
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
        expect(chunks).toHaveLength(1);
      }
    }
  });

  it('does not split even when several sessions are eligible', () => {
    expect(appearanceSets(9, 2)).toEqual([9]);
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
    [MuscleGroup.CHEST, 20],
    [MuscleGroup.LATS, 20],
  ]);

  it('uses PPLU for four sessions', () => {
    const sequence = buildFocusSequence(SplitStructure.PUSH_PULL_LEGS, 4, legMinutes);
    expect(sequence).toEqual(['PUSH', 'PULL', 'LEGS', 'UPPER']);
  });

  it.each([
    [3, ['PUSH', 'PULL', 'LEGS']],
    [4, ['PUSH', 'PULL', 'LEGS', 'UPPER']],
    [5, ['PUSH', 'PULL', 'LEGS', 'UPPER', 'LOWER']],
    [6, ['PUSH', 'PULL', 'LEGS', 'PUSH', 'PULL', 'LEGS']],
    [7, ['PUSH', 'PULL', 'LEGS', 'PUSH', 'PULL', 'LEGS', 'PUSH']],
  ])('returns the canonical PPL sequence for %i sessions', (count, expected) => {
    expect(canonicalPplFocuses(count)).toEqual(expected);
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
      [MuscleGroup.CHEST, 25],
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
      primaryMuscle: MuscleGroup.CHEST,
      secondaryMuscles: [MuscleGroup.TRICEPS, MuscleGroup.DELTS_FRONT],
    });
    const totals = effectiveSetsByMuscle([{ exercise: press, sets: 4 }]);

    expect(totals.get(MuscleGroup.CHEST)).toBe(4);
    expect(totals.get(MuscleGroup.TRICEPS)).toBe(2);
    expect(totals.get(MuscleGroup.DELTS_FRONT)).toBe(2);
  });

  it('accumulates across exercises', () => {
    const totals = effectiveSetsByMuscle([
      { exercise: exercise({ id: 'a', primaryMuscle: MuscleGroup.TRICEPS }), sets: 3 },
      {
        exercise: exercise({
          id: 'b',
          primaryMuscle: MuscleGroup.CHEST,
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
              primaryMuscle: MuscleGroup.CHEST,
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
          { exercise: exercise({ id: 'bench', primaryMuscle: MuscleGroup.CHEST }), sets: 3 },
          {
            // Lighter than the press, so the repair has a clear least-fatiguing
            // appearance to move rather than an arbitrary tie.
            exercise: exercise({
              id: 'fly',
              primaryMuscle: MuscleGroup.CHEST,
              movementVector: MovementVector.SHOULDER_HORIZONTAL_ADDUCTION,
              profile: ExerciseProfile.ISOLATION,
              criteria: {
                stretchedPositionLoading: 3,
                rangeOfMotion: 3,
                resistanceProfileMatch: 3,
                stabilityCost: 5,
                loadProgressability: 3,
                systemicFatigueCost: 5,
              },
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
      result.sessions.find((session) => session.focus === 'PULL')?.exercises[0]?.exercise.id,
    ).toBe('fly');
    expect(
      result.sessions.flatMap((s) => s.exercises).reduce((sum, e) => sum + e.sets, 0),
    ).toBe(6);
  });

  it('reports an empty session it cannot repair, with fewer appearances than sessions', () => {
    const result = distributeSelection({
      selection: {
        selected: [
          { exercise: exercise({ id: 'bench', primaryMuscle: MuscleGroup.CHEST }), sets: 3 },
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
          { exercise: exercise({ id: 'bench', primaryMuscle: MuscleGroup.CHEST }), sets: 3 },
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

describe('distributeSelection — strength exposures', () => {
  const strength = (restSeconds: number, exposures: { sets: number; topSingle: boolean }[]) => ({
    role: 'MAIN' as const,
    restSeconds,
    exposures,
  });
  const squat = exercise({
    id: 'squat',
    primaryMuscle: MuscleGroup.QUADS,
    movementVector: MovementVector.KNEE_DOMINANT,
  });
  const pausedSquat = exercise({
    id: 'paused-squat',
    primaryMuscle: MuscleGroup.QUADS,
    movementVector: MovementVector.KNEE_DOMINANT,
  });

  it('places each exposure in a different session, with its rest in the minutes', () => {
    const result = distributeSelection({
      selection: {
        selected: [
          { exercise: squat, sets: 8, strength: strength(240, [{ sets: 4, topSingle: true }, { sets: 4, topSingle: false }]) },
        ],
      },
      split: SplitStructure.FULL_BODY,
      sessionsPerMicrocycle: 3,
    });
    const appearances = result.sessions.flatMap((session) =>
      session.exercises.map((entry) => ({ session: session.index, entry })),
    );
    expect(appearances).toHaveLength(2);
    expect(new Set(appearances.map((item) => item.session)).size).toBe(2);
    expect(appearances.map((item) => item.entry.strength?.topSingle).sort()).toEqual([false, true]);
    expect(result.totalWorkMinutes).toBeCloseTo(2 * exerciseMinutes(squat, 4, 240), 5);
  });

  it('keeps more exposures than sessions only up to the session count', () => {
    const result = distributeSelection({
      selection: {
        selected: [
          { exercise: squat, sets: 12, strength: strength(240, [{ sets: 4, topSingle: true }, { sets: 4, topSingle: false }, { sets: 4, topSingle: false }]) },
        ],
      },
      split: SplitStructure.FULL_BODY,
      sessionsPerMicrocycle: 2,
    });
    expect(result.sessions.flatMap((session) => session.exercises)).toHaveLength(2);
  });

  it('prefers a mismatched session over the same pattern twice in one day', () => {
    // Two LOWER sessions and three squat appearances: the third goes to an UPPER day
    // rather than doubling up, because frequency is what a strength exposure is for.
    const result = distributeSelection({
      selection: {
        selected: [
          { exercise: squat, sets: 8, strength: strength(240, [{ sets: 4, topSingle: true }, { sets: 4, topSingle: false }]) },
          { exercise: pausedSquat, sets: 4, strength: { ...strength(240, [{ sets: 4, topSingle: false }]), role: 'VARIANT' as const } },
        ],
      },
      split: SplitStructure.UPPER_LOWER,
      sessionsPerMicrocycle: 4,
    });
    result.sessions.forEach((session) => {
      const knee = session.exercises.filter((entry) => entry.exercise.movementVector === MovementVector.KNEE_DOMINANT);
      expect(knee.length).toBeLessThanOrEqual(1);
    });
  });

  it('with no sessions reports every exposure as unassigned', () => {
    const result = distributeSelection({
      selection: {
        selected: [
          { exercise: squat, sets: 8, strength: strength(240, [{ sets: 4, topSingle: true }, { sets: 4, topSingle: false }]) },
        ],
      },
      split: SplitStructure.FULL_BODY,
      sessionsPerMicrocycle: 0,
    });
    expect(result.unassigned.map((entry) => entry.sets)).toEqual([4, 4]);
  });
});
