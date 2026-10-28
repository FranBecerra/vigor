# iOS compatibility and device acceptance

## Support is a tested contract, not every device / every iOS version

The current app and native Health module target iOS 16.4. This is a minimum deployment target, **not proof that every feature works on every supported device**. Keep availability guards and usable fallbacks for optional features. The current checkout has an iPhone 18 Pro / iOS 27 simulator and an athlete-owned iPhone 13 available; these do not certify the rest of the matrix.

Minimum acceptance targets before a public release:

| Target | Purpose | Current evidence |
| --- | --- | --- |
| iOS 16.4, smallest supported screen | Oldest API/runtime, layout and fallback behavior | Not certified; install a compatible runtime/device and run the same flows |
| iOS 18, representative older iPhone | Previous-generation API path and performance | Not certified |
| iOS 26, representative physical iPhone | New system-feature availability boundary | Not certified |
| iOS 27, small and large iPhones | Current runtime, layout and native integration | Existing simulator checks cover selected flows only |
| Supported iPad screen sizes | Tablet layout / sheet / keyboard behavior | Not certified |
| Paired Apple Watch | Forwarded alert routing, Smart Stack layout | A Live Activity is not a Vigor watchOS workout app; physical acceptance required |

Recheck the actual deployment target after SDK/native dependency changes. Do not advertise older iOS support just because a JavaScript test passes. Do not raise the target silently to avoid a failing fallback. Use TestFlight (once distribution is configured and authorized) to include more real hardware and retain device/OS/build-specific results.

## Automated gates for every candidate build

1. `npx tsc --noEmit` and `npm test -- --runInBand`.
2. Existing responsiveness benchmarks with their original baselines/budgets; no threshold relaxation.
3. Native Release compilation for simulator and physical devices, plus strict signature verification for the delivered app.
4. Build/run on the oldest supported runtime and current runtime. A current-SDK compile with a 16.4 deployment target is not an iOS 16.4 runtime test.
5. Native deadline-policy check on macOS:

   ```sh
   xcrun swiftc -parse-as-library modules/vigor-health/ios/RestFeedbackPolicy.swift scripts/check-rest-feedback-policy.swift -module-cache-path /private/tmp/vigor-rest-swift-cache -o /private/tmp/vigor-rest-policy-check
   /private/tmp/vigor-rest-policy-check
   ```

The Swift check exercises expiry/background decisions only, not notification delivery. Jest checks that each rest replaces the stable notification, includes sound, preserves a locked-screen OS request even when native foreground scheduling succeeds, and does not replay expired restored rests.

## Shared real-device smoke flows

Cover light/dark, increased Dynamic Type, VoiceOver labels, all four languages, metric/imperial, offline cold start, interrupted saves, app background/resume, process restart, owner change, empty history and denied optional permissions. Run strength set entry / correction / timer restart, rehabilitation, history edits, routine generation/cancellation and Bio missing-data/fallback states. Preserve athlete data: use the in-memory acceptance fixtures for mutations, never complete a real session as a test.

## Rest-alert acceptance matrix — release blocker while unresolved

Use `vigor://workout-check`, which has no account writes. Start at least **five successive rests** per condition, not just the first alarm. Use a longer countdown when needed to lock the phone/open another app before the deadline. The athlete must confirm actual sound/haptic perception; a scheduling acknowledgement or `AVAudioPlayer.play() == true` is not sufficient.

| Dimension | Required conditions |
| --- | --- |
| App state | Vigor visible; other app visible; phone locked; return after expiry (no late chime) |
| Other audio | None; Spotify playing; Spotify manually paused; Audible playing; Audible manually paused |
| Route | Built-in speaker; wired/Bluetooth headphones; route disconnect during rest |
| System settings | Ring/silent; Focus off/on; notification sound allowed/disabled; normal/low volume |
| Watch | Paired/unpaired; worn/unlocked; notification forwarding enabled/disabled |
| Timer changes | First/subsequent set; shorten/extend active rest; new set replaces old deadline; cancel; finish; discard |

Record build, device/OS, route, settings, each observed phone/watch result and the fixture's local diagnostic snapshot. Diagnostics expose only this app's rest notification counts/settings, audio route and player state, never Health samples or other applications' notifications. They cannot read the hardware silent switch or guarantee the Watch's forwarding settings.

### Delivery boundaries

- **Foreground:** native short chime/haptics; Expo audio/haptics fallback. Idle clocks do not configure the global audio session. Native work delayed by suspension expires rather than chiming on return.
- **Locked/background:** the current implementation uses an ordinary scheduled local notification. Notification permission, sound setting, silent mode, Focus and OS routing apply. Do not keep a fake silent-audio loop alive or misuse critical-alert permissions to bypass user settings.
- **Watch:** iOS ordinarily routes a notification to the phone *or* the Watch, not both. An unlocked phone usually receives it instead of the Watch. No independent Watch haptic lifecycle is implemented.
- **Athlete decision (2026-10-28):** retain a brief alert that respects silent mode. Do not adopt AlarmKit or request an alarm permission. AlarmKit was evaluated as a distinct, prominent alarm requiring a stop interaction, not a drop-in short-chime fix. The reported locked-screen delivery failure still requires investigation within the ordinary-notification contract.

The athlete previously reported no sound or vibration with the phone locked and Audible playing, and with Spotify paused. On 2026-10-28, the three-second foreground test produced sound and vibration on the iPhone. The subsequent 20-second locked-screen rest test did **not** work; no Apple Watch was being worn, so Watch delivery was not tested. Device-local settings showed notification authorization, sound, alerts and lock-screen display enabled. At the post-return diagnostic snapshot, the native callback had fired about ten seconds after its deadline while the app was backgrounded, and no pending or delivered rest notification remained. This snapshot was taken after Vigor's cleanup and cannot prove whether iOS delivered or presented the alert. A follow-up retains the count of Vigor rest notifications still present immediately before cleanup, locally on device. A positive count confirms the OS left a visible notification; a zero count still cannot rule out a transient banner that disappeared. Root cause and repeat acceptance remain open.

### Candidate evidence — 2026-10-28

**Later athlete clarification:** Work Focus was active during the failed locked-screen test. After leaving that mode, the athlete confirms the installed app sounds with the iPhone locked. No intervening update was installed, so this is acceptance of the existing candidate in the tested configuration, not evidence of the unshipped diagnostic change fixing delivery. Watch sound/haptics have not been reported separately. Ordinary alerts continue to respect Focus and silent settings; broader repeatability remains part of the matrix.

TypeScript and 2,288 tests / 206 suites pass; feedback policy coverage is 100% across 25 cases. The native deadline-policy harness passes 15 cases. Release builds for the iOS 27 simulator and connected iPhone 13 both succeed, with strict deep signature verification. The physical candidate bundles the same chime bytes as the source asset. The simulator visibly verifies selecting/clearing finish effort and reports two successive foreground native plays plus one pending 20-second sound-bearing notification. CoreDevice updated the existing iPhone 13 app without removing its data; Device Hub showed the in-memory workout-check fixture. The foreground three-second test worked on the iPhone. The 20-second locked-screen test failed. The user was not wearing the Apple Watch, so its delivery remains untested. Local OS setting values appeared enabled, but post-return cleanup erased delivery evidence. A follow-up adds a device-local delivered-count snapshot before cleanup. No account/workout/Health data or permissions were changed; no new permission or entitlement is added.

## Official references checked on 2026-10-28

- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/) and [Notifications](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/).
- [Apple: notifications on Apple Watch](https://support.apple.com/en-us/108369).
- [Apple: AlarmKit scheduling, authorization and presentations](https://developer.apple.com/documentation/AlarmKit/scheduling-an-alarm-with-alarmkit).
- [Apple: running on simulated or physical devices](https://developer.apple.com/documentation/xcode/running-your-app-on-simulated-or-physical-devices).
