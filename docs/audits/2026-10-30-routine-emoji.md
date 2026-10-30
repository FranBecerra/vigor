# System emoji routine identity — 2026-10-30

## Scope

Implement the two requested checklist items: system-rendered routine emoji and one fixed app-accent-derived badge background. No change to navigation/status/action pictograms or training prescriptions. No physical iPhone update, athlete routine write, infrastructure deployment, commit or push.

Official documentation checked before implementation: [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/), [React Native 0.86 Text](https://reactnative.dev/docs/0.86/text) and [Text style props](https://reactnative.dev/docs/0.86/text-style-props). Use existing native text rendering, not a new image service/library.

## Contracts

- 24 selectable object/nature/astronomy emoji, complete centred rows of four/six 48-point controls, named radio selection and hidden decorative glyph accessibility.
- Preserve legacy keys and colours, no bulk rewrite. New catalogue keys are additive; retired keys have object-only emoji approximations and remain readable. Unknown/prototype-like keys fall back safely to planet.
- All three badge surfaces use live `colors.accentTint`; no colour picker. Theme updates do not trigger identity writes or discard a selected emoji.
- New routines use the current app accent in the compatibility colour field, not an old picker value. Existing name/icon updates do not touch that field, prescriptions or history. A colour-only difference does not enable Save.

## Verification

- TypeScript passes (`/private/tmp/vigor-routine-emoji-types.log`). Initial focused behavior run: 85 tests / seven suites. Expanded focused coverage run: 57 tests / four suites with **100% statements/branches/functions/lines** for `routineEmoji` (`/private/tmp/vigor-routine-emoji-coverage.log`). The expanded run checks all ten accents in both appearances on picker/Today/routine surfaces, selection preservation, narrow/wide rows and defensive legacy/malformed-key rendering. Creation and repository tests cover app-accent storage and icon-only owner-safe updates.
- A narrow-screen test initially attempted to spy on the hook, but did not change the React Native window metrics. Drive the actual test `Dimensions` boundary instead; widths 320/375/376/430/1024 now pass without relaxing layout assertions. Missing keys in an old synthetic microcycle fixture are also corrected without changing production layout.
- Signed simulator Release succeeds (`/private/tmp/vigor-routine-emoji-native.log`); strict deep signature verification passes. Update the iPhone 18 Pro simulator in place, not the physical iPhone.
- Device Hub / iOS 27 verifies Home → identity sheet: 24 native emoji in four complete six-column rows, existing legacy identity rendered safely, Save initially disabled, Cohete selection/preview/selected state, Save enabled, no colour controls, and Cancel preserving the saved identity. The Home Today/routine badges share the same accent tint. No Save is pressed.
- Home → New routine → Manual verifies planet selected by default, the same shared grid/tint, Satélite selection and Cancel → creation choice → Home. The draft is never saved. Representative native screenshots show the light Subtle surfaces; the complete light/dark/accent matrix is component coverage, not native acceptance on every device/appearance.
- Final full regression: **3,033 tests / 254 suites**, exit zero, **160.325 seconds** (`/private/tmp/vigor-routine-emoji-regression.log`). TypeScript and whitespace checks pass. No timeout, coverage threshold or performance budget is relaxed.

Synthetic/stub persistence is not a real athlete-account write; semantic UI actions are not physical gesture acceptance. No actual routine, account setting, Health permission or physical-phone installation is modified by native checks.
