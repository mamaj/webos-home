#!/bin/sh
set -eu
umask 077
BASE=/var/lib/webosbrew/reza-home-v1
CINEMA=/var/lib/webosbrew/reza-cinema-v1
SRC=/tmp/reza-logo-refine
BACKUP=$BASE/before-logo-refinement-v1
test ! -e "$BASE/disabled"
/usr/bin/node --check "$SRC/home-feed-refresh.js"
/usr/bin/node --check "$SRC/logo-analysis.js"
systemctl stop reza-cinema-refresh.timer reza-cinema-refresh.service
if [ ! -d "$BACKUP" ]; then
  mkdir -m 700 "$BACKUP"
  cp "$CINEMA/home-feed-refresh.js" "$CINEMA/collections-state.json" "$BACKUP/"
fi
cp "$SRC/logo-analysis.js" "$CINEMA/logo-analysis.js"
cp "$SRC/home-feed-refresh.js" "$CINEMA/home-feed-refresh.js"
cp "$SRC/runtime/collections-state.json" "$CINEMA/collections-state.json"
chmod 600 "$CINEMA/collections-state.json"
cp -a "$SRC/runtime/metadata-cache/." "$CINEMA/metadata-cache/"
cp -a "$SRC/runtime/collections/." "$CINEMA/collections/"
/usr/bin/node "$CINEMA/home-feed-refresh.js" --publish-only
systemctl start reza-cinema-refresh.timer
luna-send -n 1 -f -w 5000 luna://com.webos.applicationManager/running '{}' >"$BASE/logo-running.json"
/usr/bin/node -e 'var fs=require("fs"),r=JSON.parse(fs.readFileSync("/var/lib/webosbrew/reza-home-v1/logo-running.json","utf8")),a=r.running.filter(function(a){return a.id==="com.webos.app.home"&&a.appType==="web";})[0];if(a&&/^\d+$/.test(a.webprocessid)){var cmd=fs.readFileSync("/proc/"+a.webprocessid+"/cmdline","utf8");if(cmd.indexOf("WebAppMgr")<0||cmd.indexOf("--type=renderer")<0)throw Error("Unexpected renderer");process.kill(Number(a.webprocessid),"SIGTERM");}'
sleep 2
luna-send -n 1 -f -w 5000 luna://com.webos.applicationManager/launch '{"id":"com.webos.app.home"}'
echo 'Native logo rendering and selection published; background quality preserved.'
