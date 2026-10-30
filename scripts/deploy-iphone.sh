#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
node_binary="$(command -v node || true)"
if [[ -z "$node_binary" ]]; then
  for candidate in /opt/homebrew/bin/node /usr/local/bin/node; do
    if [[ -x "$candidate" ]]; then node_binary="$candidate"; break; fi
  done
fi
if [[ -z "$node_binary" ]]; then
  printf 'Node.js is required. Install the project Node.js version and retry.\n' >&2
  exit 1
fi
export PATH="$(dirname "$node_binary"):$PATH"
exec "$node_binary" "$project_root/scripts/deploy-iphone.cjs" "$@"
