#!/bin/bash
set -euo pipefail
# Requires an installed Release build and an authenticated simulator. No reinstall or data reset.
benchmark_device="${1:?Pass the explicit simulator UDID}"
benchmark_output="${2:-output/performance}"
benchmark_run="$(date +%s)-$$"
benchmark_container="$(xcrun simctl get_app_container "$benchmark_device" com.franciscobecerra.vigor data)"
benchmark_report="$benchmark_container/Documents/vigor-ui-performance-$benchmark_run.json"
xcrun simctl openurl "$benchmark_device" "vigor://performance?autorun=$benchmark_run&target=simulator-$benchmark_device"
for benchmark_attempt in $(seq 1 120); do
  if [ -s "$benchmark_report" ]; then
    mkdir -p "$benchmark_output"
    benchmark_copy="$benchmark_output/ios-$benchmark_run.json"
    cp "$benchmark_report" "$benchmark_copy"
    node --import tsx scripts/check-ui-performance.ts "$benchmark_copy" "${@:3}"
    exit $?
  fi
  sleep 1
done
echo 'Native benchmark timed out without a complete report.' >&2
exit 1
