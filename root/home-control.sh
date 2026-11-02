#!/bin/sh
set -eu
BASE=/var/lib/webosbrew/reza-home-v1
DIR=/tmp/reza-home-control
umask 077
mkdir -p "$DIR"
[ -p "$DIR/actions" ] || mkfifo "$DIR/actions"
exec 3<>"$DIR/actions"
/usr/bin/node "$BASE/home-watch.js" &
watch_pid=$!
trap 'kill "$watch_pid" 2>/dev/null || true' EXIT
trap 'exit 0' TERM INT
launch_home() {
  attempt=0
  while [ "$attempt" -lt 6 ]; do
    luna-send -n 1 -f -w 5000 luna://com.webos.applicationManager/launch '{"id":"com.webos.app.home"}' >"$DIR/last-launch.json"
    if /usr/bin/node -e 'var r=JSON.parse(require("fs").readFileSync("/tmp/reza-home-control/last-launch.json","utf8"));process.exit(r.returnValue===true?0:1);'; then return 0; fi
    attempt=$((attempt + 1))
    sleep 1
  done
  return 1
}
launch_home
while kill -0 "$watch_pid" 2>/dev/null; do
  if read -r -t 5 action <&3; then
    case "$action" in
      home)
        # Allow LG's normal Home handling first. Native apps that swallow Home
        # still get a fallback; an already visible Home is not launched twice.
        luna-send -n 1 -f -w 3000 luna://com.webos.applicationManager/getForegroundAppInfo '{}' >"$DIR/foreground.json"
        if ! /usr/bin/node -e 'var r=JSON.parse(require("fs").readFileSync("/tmp/reza-home-control/foreground.json","utf8"));process.exit(r.returnValue===true&&r.appId==="com.webos.app.home"?0:1);'; then launch_home; fi
        ;;
      restore) sh "$BASE/undo.sh" --from-controller; exit 0 ;;
    esac
  fi
done
exit 1
