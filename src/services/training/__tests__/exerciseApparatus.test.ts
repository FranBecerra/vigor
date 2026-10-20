import { ExerciseApparatus as A, Equipment, type Exercise } from '@/models';
import { EXERCISE_CATALOGUE, filterCatalogue, parseExercise } from '../exerciseCatalogue';
import { apparatusCapabilities, apparatusRequirements, apparatusOptions, GUIDE_ARM_APPARATUS } from '../exerciseApparatus';
import { catalogueWithArmGeometry, withArmGeometryDescriptors } from '../armSelectionDescriptors';

const at = (id: string) => EXERCISE_CATALOGUE.find((exercise) => exercise.id === id)!;

it('records all 63 source-arm setups, including explicit absence of additional modeled support', () => {
  expect(Object.keys(GUIDE_ARM_APPARATUS)).toHaveLength(63);
  expect(apparatusRequirements(at('curl-barra'))).toEqual([]);
  expect(apparatusRequirements(at('curl-bayesian'))).toBeUndefined();
  expect(apparatusRequirements(at('guide-239'))).toEqual([A.ADJUSTABLE_BENCH, A.DUAL_CABLE, A.HANDLE_PAIR]);
  expect(apparatusOptions(at('guide-222'))).toHaveLength(2);
});

it('keeps unknown apparatus availability distinct from an explicitly empty inventory', () => {
  const original = [at('curl-inclinado'), at('curl-barra'), at('curl-bayesian')];
  expect(filterCatalogue(original, {})).toEqual(original);
  expect(filterCatalogue(original, { availableApparatus: [] })).toEqual([original[1], original[2]]);
  expect(filterCatalogue(original, { availableApparatus: [A.FLAT_BENCH] })).not.toContain(original[0]);
  expect(filterCatalogue(original, { availableApparatus: [A.ADJUSTABLE_BENCH] })).toEqual(original);
});

it('does not infer specialty implements, machine geometry or two cable lines from generic equipment', () => {
  const roman = at('guide-235'), seatedBayesian = at('guide-239'), preacher = at('curl-predicador');
  expect(filterCatalogue([roman], { availableEquipment: [Equipment.BARBELL], availableApparatus: [] })).toEqual([]);
  expect(filterCatalogue([roman], { availableEquipment: [Equipment.BARBELL], availableApparatus: [A.ROMAN_BAR] })).toEqual([roman]);
  expect(filterCatalogue([seatedBayesian], { availableEquipment: [Equipment.CABLE],
    availableApparatus: [A.ADJUSTABLE_BENCH, A.SINGLE_HANDLE] })).toEqual([]);
  expect(filterCatalogue([seatedBayesian], { availableEquipment: [Equipment.CABLE],
    availableApparatus: [A.ADJUSTABLE_BENCH, A.DUAL_CABLE, A.HANDLE_PAIR] })).toEqual([seatedBayesian]);
  expect(filterCatalogue([preacher], { availableEquipment: [Equipment.MACHINE], availableApparatus: [] })).toEqual([]);
  expect(filterCatalogue([preacher], { availableEquipment: [Equipment.MACHINE], availableApparatus: [A.HIGH_CURL_MACHINE] })).toEqual([]);
});

it('supports explicit alternatives without requiring every substitute, or accepting incomplete groups', () => {
  const highExtension = at('guide-212'), supine = at('guide-222');
  for (const attachment of [A.BAR_ATTACHMENT, A.ROPE_ATTACHMENT]) {
    expect(filterCatalogue([highExtension], { availableApparatus: [attachment] })).toEqual([highExtension]);
  }
  expect(filterCatalogue([supine], { availableApparatus: [A.MAT, A.ROPE_PAIR] })).toEqual([supine]);
  expect(filterCatalogue([supine], { availableApparatus: [A.FLAT_BENCH, A.LONG_ROPE] })).toEqual([supine]);
  expect(filterCatalogue([supine], { availableApparatus: [A.MAT] })).toEqual([]);
  expect(filterCatalogue([supine], { availableApparatus: [A.LONG_ROPE] })).toEqual([]);
});

it('expands only explicit capability implications and preserves both inventories and vetoes', () => {
  const inventory = [A.ADJUSTABLE_BENCH, A.LONG_ROPE_PAIR, A.HANDLE_PAIR, A.WIDE_CABLE_PORTAL];
  const before = [...inventory];
  const result = apparatusCapabilities(inventory);
  for (const item of [A.FLAT_BENCH, A.SEAT, A.ROPE_PAIR, A.LONG_ROPE, A.ROPE_ATTACHMENT, A.SINGLE_HANDLE, A.DUAL_CABLE]) {
    expect(result.has(item)).toBe(true);
  }
  expect(result.has(A.PREACHER_BENCH)).toBe(false);
  expect(inventory).toEqual(before);
  expect(filterCatalogue([at('curl-inclinado')], { availableApparatus: inventory, vetoedExerciseIds: ['curl-inclinado'] })).toEqual([]);
  expect(filterCatalogue([at('curl-inclinado')], { availableApparatus: inventory, availableEquipment: [] })).toEqual([]);
});

it.each([null, 'BENCH', [A.SEAT, A.SEAT], ['UNKNOWN'], [NaN]])('rejects invalid mandatory apparatus: %j', (requiredApparatus) => {
  expect(() => parseExercise({ ...at('curl-barra'), requiredApparatus })).toThrow('requiredApparatus');
});
it.each([null, 'BENCH', [[]], [[A.SEAT, A.SEAT]], [['UNKNOWN']], [A.SEAT]])('rejects invalid alternative apparatus: %j', (options) => {
  expect(() => parseExercise({ ...at('curl-barra'), apparatusOptions: options })).toThrow('apparatusOptions');
});
it('accepts empty requirements and copies valid parsed options without mutating input', () => {
  const raw = { ...at('curl-barra'), requiredApparatus: [], apparatusOptions: [[A.SEAT, A.FLAT_BENCH]] };
  const before = JSON.stringify(raw);
  expect(parseExercise(raw).apparatusOptions).toEqual(raw.apparatusOptions);
  expect(parseExercise({ ...raw, apparatusOptions: [] }).apparatusOptions).toEqual([]);
  expect(JSON.stringify(raw)).toBe(before);
});

it('replaces unverified arm curves with observable implement/support, without changing scores or dose', () => {
  const original = at('curl-inclinado');
  const arm = { ...original, stimulusTags: [...original.stimulusTags!, 'RESISTANCE:LENGTHENED'] }, bench = at('press-banca');
  const before = JSON.stringify([arm, bench]);
  const result = catalogueWithArmGeometry([arm, bench]);
  expect(result[0].stimulusTags).toEqual(['SHOULDER:EXTENDED', 'GRIP:SUPINATED', 'IMPLEMENT:DUMBBELL', 'SUPPORT:BACKREST']);
  expect(result[0].criteria).toBe(arm.criteria);
  expect(withArmGeometryDescriptors(result[0])).toBe(result[0]);
  expect(result[1]).toBe(bench);
  expect(withArmGeometryDescriptors({ ...arm, stimulusTags: undefined }).stimulusTags).toBeUndefined();
  expect(withArmGeometryDescriptors({ ...arm, stimulusTags: ['RESISTANCE:EVEN'] }).stimulusTags)
    .toEqual(['IMPLEMENT:DUMBBELL', 'SUPPORT:BACKREST']);
  const untouched: Exercise = { ...arm, stimulusTags: ['GRIP:SUPINATED', 'IMPLEMENT:DUMBBELL', 'SUPPORT:BACKREST'] };
  expect(withArmGeometryDescriptors(untouched)).toBe(untouched);
  expect(JSON.stringify([arm, bench])).toBe(before);
});
