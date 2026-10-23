#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
workspace="$project_root/ios/vigor.xcworkspace"
scheme="${VIGOR_SCHEME:-vigor}"
bundle_id="com.franciscobecerra.vigor"
derived_data="${VIGOR_DERIVED_DATA:-$project_root/ios/build}"
device_id="${VIGOR_DEVICE_UDID:-}"

cd "$project_root"

if [[ -z "$device_id" ]]; then
  printf 'Looking for a connected iPhone…\n'
  devices_json="$(xcrun devicectl list devices --search iPhone --json-output - --timeout 45)"
  device_id="$(printf '%s' "$devices_json" | python3 -c '
import json, re, sys

payload = json.load(sys.stdin)
candidates = []

def walk(value):
    if isinstance(value, dict):
        name = str(value.get("name") or value.get("deviceName") or value.get("deviceProperties", {}).get("name") or "")
        platform = str(value.get("platform") or "")
        state = str(value.get("state") or value.get("connectionProperties", {}).get("state") or "")
        identifier = str(value.get("identifier") or value.get("udid") or value.get("deviceProperties", {}).get("udid") or value.get("hardwareProperties", {}).get("udid") or "")
        is_simulator = "simulator" in (name + " " + platform).lower() or value.get("isSimulator") is True
        if "iphone" in name.lower() and not is_simulator and re.fullmatch(r"[0-9A-Fa-f-]{16,}", identifier):
            if not state or any(word in state.lower() for word in ("available", "connected", "ready")):
                candidates.append((name, identifier))
        for child in value.values():
            walk(child)
    elif isinstance(value, list):
        for child in value:
            walk(child)

walk(payload)
candidates = list(dict.fromkeys(candidates))
if len(candidates) != 1:
    print("", end="")
    if not candidates:
        print("Could not find one available physical iPhone. Connect and unlock it, then retry, or set VIGOR_DEVICE_UDID.", file=sys.stderr)
    else:
        print("More than one physical iPhone is available. Set VIGOR_DEVICE_UDID to choose one:", file=sys.stderr)
        for name, identifier in candidates:
            print(f"  {name}: {identifier}", file=sys.stderr)
    sys.exit(2)
print(candidates[0][1])
')"
fi

if [[ -z "$device_id" ]]; then
  printf 'Set VIGOR_DEVICE_UDID to the phone UDID and retry.\n' >&2
  exit 2
fi

printf 'Building %s for iPhone %s…\n' "$scheme" "$device_id"
xcodebuild \
  -workspace "$workspace" \
  -scheme "$scheme" \
  -configuration Release \
  -sdk iphoneos \
  -destination "id=$device_id" \
  -derivedDataPath "$derived_data" \
  build

app_path="$derived_data/Build/Products/Release-iphoneos/vigor.app"
if [[ ! -d "$app_path" ]]; then
  printf 'Build succeeded but the app bundle was not found at %s\n' "$app_path" >&2
  exit 1
fi

printf 'Installing without removing the existing app or its data…\n'
xcrun devicectl device install app --device "$device_id" "$app_path" --timeout 120
printf 'Launching Vigor…\n'
xcrun devicectl device process launch --device "$device_id" "$bundle_id" --timeout 60
printf 'Vigor is installed and launched on %s.\n' "$device_id"
