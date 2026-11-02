#!/bin/sh
set -eu
if [ -n "${NODE_BINARY:-}" ]; then exec "$NODE_BINARY" "$@"; fi
if command -v node >/dev/null 2>&1; then exec node "$@"; fi
bundled="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
if [ -x "$bundled" ]; then exec "$bundled" "$@"; fi
printf '%s\n' 'Install Node.js 20+ or set NODE_BINARY.' >&2
exit 1
