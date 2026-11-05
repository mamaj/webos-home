#!/bin/sh
set -eu
BASE=/var/lib/webosbrew/reza-speaker-v1
umask 077
if [ -f "$BASE/service.log" ]; then mv "$BASE/service.log" "$BASE/service-previous.log"; fi
exec /usr/bin/node "$BASE/worker.js" >"$BASE/service.log" 2>&1
