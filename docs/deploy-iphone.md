# Install Vigor on your iPhone 13 without Codex

## One-click option

Connect and unlock the iPhone 13, then double-click **Install Vigor.command** in the project folder. Terminal opens and displays build/install progress. This uses local Xcode tools, not Codex or an AI subscription. Keep the phone connected until installation completes.

## Terminal option

From the project directory:

```sh
npm run deploy:iphone
```

Or run `/Users/franbecerra/vigor/scripts/deploy-iphone.sh` from any directory. Use `--help` for usage without building or connecting to a device.

## What it does

1. Select exactly one paired, booted **physical iPhone 13** from Xcode's structured device list; ignore simulators, Watch and other phone models. Fail on missing/ambiguous devices instead of choosing the first result.
2. Run an incremental Release build from current source. Xcode reuses unchanged native build products. Refresh the JavaScript bundle; do not skip the build based on an unreliable timestamp or install a stale binary after a build failure.
3. Verify the complete app signature. Stop if build/signature validation fails.
4. Update the existing `com.franciscobecerra.vigor` installation in place, without uninstalling or resetting data.
5. Launch Vigor. If the app installed but iOS prevents opening it, report **installed** separately and ask you to unlock/open it manually.

Requirements: macOS, Xcode with an installed iOS SDK and configured valid signing identity, project Node.js/dependencies, a paired iPhone with Developer Mode enabled. The script does not change Developer Mode, trust settings, signing accounts, Health permissions, provisioning capabilities or infrastructure. It does not run tests automatically; use `npm test -- --runInBand` when verifying code changes before deployment. It cannot bypass an expired signing profile or a locked-device restriction.

Optional environment overrides:

```sh
VIGOR_DEVICE_UDID="your-physical-device-identifier" npm run deploy:iphone
VIGOR_DERIVED_DATA="/absolute/cache/path" npm run deploy:iphone
```

An explicit target must still match a real paired, booted iPhone in the device list; it never permits a simulator. File paths with spaces are passed as argument arrays. No credentials or Codex access are required by the script itself; Xcode must already be set up.

Regression tests stub all external commands: device-list changes, missing/duplicate devices, simulators/Watch, invalid IDs, disabled Developer Mode, missing dependencies/product, build/sign/install/launch failure ordering and explicit overrides. They do not install anything.
