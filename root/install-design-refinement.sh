#!/bin/sh
set -eu
umask 077
BASE=/var/lib/webosbrew/reza-home-v1
CINEMA=/var/lib/webosbrew/reza-cinema-v1
SRC=/tmp/reza-design-deploy
BACKUP=$BASE/before-design-033
for f in home-feed-refresh.js imdb-ratings.js app/collections.js; do /usr/bin/node --check "$SRC/$f"; done
test ! -e "$BASE/disabled"
test -f /tmp/reza-home-app/appinfo.json
systemctl stop reza-cinema-refresh.timer reza-cinema-refresh.service
trap 'systemctl start reza-cinema-refresh.timer' EXIT
if [ ! -d "$BACKUP" ]; then
 mkdir -m 700 "$BACKUP"
 tar -cf "$BACKUP/app.tar" -C "$BASE" app
 cp "$CINEMA/home-feed-refresh.js" "$CINEMA/collections-state.json" "$BACKUP/"
fi
cp "$SRC/home-feed-refresh.js" "$SRC/imdb-ratings.js" "$SRC/imdb-ratings.json" "$SRC/logo-quality.json" "$CINEMA/"
chmod 600 "$CINEMA/imdb-ratings.json" "$CINEMA/logo-quality.json"
cp "$SRC/collections/assets/"*.png "$CINEMA/collections/assets/"
for D in "$BASE/app" /media/developer/apps/usr/palm/applications/com.reza.tvhome /tmp/reza-home-app; do
 test -f "$D/appinfo.json"
 mkdir -p "$D/fonts"
 cp "$SRC/app/collections.js" "$SRC/app/collections.css" "$SRC/app/index.html" "$D/"
 cp "$SRC/app/fonts/"* "$D/fonts/"
 /usr/bin/node -e 'var fs=require("fs"),p=process.argv[1]+"/appinfo.json",a=JSON.parse(fs.readFileSync(p,"utf8"));if(a.vendor!=="Personal"||["com.reza.tvhome","com.webos.app.home"].indexOf(a.id)<0)throw Error("Unexpected manifest");a.version="0.3.3";fs.writeFileSync(p,JSON.stringify(a,null,2));' "$D"
 chmod 644 "$D/collections.js" "$D/collections.css" "$D/index.html" "$D/appinfo.json" "$D/fonts/"*
 chmod 755 "$D/fonts"
done
/usr/bin/node "$CINEMA/home-feed-refresh.js" --publish-only
luna-send -n 1 -f -w 5000 luna://com.webos.applicationManager/running '{}' >"$BASE/design-running.json"
/usr/bin/node -e 'var fs=require("fs"),r=JSON.parse(fs.readFileSync("/var/lib/webosbrew/reza-home-v1/design-running.json","utf8"));r.running.filter(function(a){return ["com.webos.app.home","com.reza.tvhome"].indexOf(a.id)>=0&&a.appType==="web";}).forEach(function(a){if(/^\d+$/.test(a.webprocessid)){var cmd=fs.readFileSync("/proc/"+a.webprocessid+"/cmdline","utf8");if(cmd.indexOf("WebAppMgr")<0||cmd.indexOf("--type=renderer")<0)throw Error("Unexpected renderer");process.kill(Number(a.webprocessid),"SIGTERM");}});'
sleep 2
luna-send -n 1 -f -w 5000 luna://com.webos.applicationManager/launch '{"id":"com.webos.app.home"}'
echo 'Personal Home 0.3.3 design deployed.'
