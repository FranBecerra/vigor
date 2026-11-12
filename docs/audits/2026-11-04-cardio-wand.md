# Approved hybrid identity and cardio recommendation — 2026-11-04

## Scope

The athlete selects Convergence (Merge) for hybrid and Sections for the cardio form. They explicitly request the wand-labelled Decide for me action. The full grouped entry, full Sections form and unified intake/progress remain separate open items; this increment implements the selected symbol in the existing entry and the visible recommendation action in the current setup.

The recommendation row appears once below the heading on each setup step. At activity selection it opens current-practice intake without modifying dose. From intake it applies the existing recommendation and opens allocation; in allocation it changes visible values. Invalid input or an active save/optimization disables it. Applied suggestions become explicit availability choices, preserving them through subsequent navigation. Existing shared capacity and Health-derived boundaries are reused.

## Verification

- Full `npm test -- --runInBand --watchman=false`: 3,302 tests / 277 suites pass (156.928 seconds).
- TypeScript and whitespace pass. Final simulator Release and strict deep signature verification pass.
- Final-binary Device Hub coordinate acceptance: open the memory-only history fixture, create cardio, inspect the visible wand, tap it to reach current practice, tap again to see allocation, cancel directly to the fixture. No programme is saved.
- The convergence symbol in the existing creation entry has component coverage; its separate final-binary visual acceptance remains open.
- App accessibility controls remain unavailable. Screenshots and outer accessibility hierarchy are captured before/after actions; coordinate taps work. No DeviceInteraction session was opened.


No physical installation, Health permission/query, real athlete write, commit or push belongs to this increment.
