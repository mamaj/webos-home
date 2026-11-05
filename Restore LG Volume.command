#!/bin/sh
set -eu
project_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec sh "$project_dir/tools/node-runtime.sh" "$project_dir/tools/speaker/control-tv.cjs" disable
