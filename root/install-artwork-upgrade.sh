#!/bin/sh
set -eu
umask 077
BASE=/var/lib/webosbrew/reza-home-v1
CINEMA=/var/lib/webosbrew/reza-cinema-v1
SRC=/tmp/reza-artwork-upgrade
BACKUP=$BASE/before-high-resolution-v1
test ! -e "$BASE/disabled"
/usr/bin/node --check "$SRC/home-feed-refresh.js"
/usr/bin/node --check "$SRC/logo-analysis.js"
/usr/bin/node --check "$SRC/collections.js"
/usr/bin/node -e 'var fs=require("fs"),s=JSON.parse(fs.readFileSync("/tmp/reza-artwork-upgrade/runtime/collections-state.json","utf8"));if(s.rows.length!==5||!Object.keys(s.enrichment).every(function(k){return s.enrichment[k].artwork;}))throw Error("Artwork preparation incomplete");'
systemctl stop reza-cinema-refresh.timer reza-cinema-refresh.service
if [ ! -d "$BACKUP" ]; then
  mkdir -m 700 "$BACKUP"
  cp -a "$BASE/app" "$BACKUP/app"
  cp "$CINEMA/home-feed-refresh.js" "$CINEMA/collections-state.json" "$BACKUP/"
  cp -a "$CINEMA/collections" "$BACKUP/collections"
fi
cp "$SRC/home-feed-refresh.js" "$CINEMA/home-feed-refresh.js"
cp "$SRC/logo-analysis.js" "$CINEMA/logo-analysis.js"
cp "$SRC/runtime/collections-state.json" "$CINEMA/collections-state.json"
chmod 600 "$CINEMA/collections-state.json"
cp -a "$SRC/runtime/metadata-cache/." "$CINEMA/metadata-cache/"
cp -a "$SRC/runtime/collections/." "$CINEMA/collections/"
cp "$SRC/collections.js" "$SRC/collections.css" "$SRC/appinfo.json" "$BASE/app/"
cp "$SRC/com.reza.tvhome_0.3.2_all.ipk" /media/developer/temp/reza-personal-home.ipk
chmod 644 /media/developer/temp/reza-personal-home.ipk
luna-send -i -f -w 15000 luna://com.webos.appInstallService/dev/install '{"id":"com.reza.tvhome","ipkUrl":"/media/developer/temp/reza-personal-home.ipk","subscribe":true}' >"$BASE/artwork-install.json"
/usr/bin/node -e 'var fs=require("fs"),a=JSON.parse(fs.readFileSync("/media/developer/apps/usr/palm/applications/com.reza.tvhome/appinfo.json","utf8"));if(a.version!=="0.3.2")throw Error("Artwork UI update incomplete");'
cp "$SRC/collections.js" "$SRC/collections.css" /tmp/reza-home-app/
/usr/bin/node -e 'var fs=require("fs"),p="/tmp/reza-home-app/appinfo.json",a=JSON.parse(fs.readFileSync(p,"utf8"));if(a.id!=="com.webos.app.home"||a.vendor!=="Personal")throw Error("Unexpected Home manifest");a.version="0.3.2";fs.writeFileSync(p,JSON.stringify(a,null,2));'
find /tmp/reza-home-app -type d -exec chmod 755 '{}' \;
find /tmp/reza-home-app -type f -exec chmod 644 '{}' \;
/usr/bin/node "$CINEMA/home-feed-refresh.js" --publish-only
cp /var/lib/webosbrew/reza-weather-v1/public/feed.js /media/developer/apps/usr/palm/applications/com.reza.tvhome/weather/feed.js
chmod 644 /media/developer/apps/usr/palm/applications/com.reza.tvhome/weather/feed.js
systemctl start reza-cinema-refresh.timer
luna-send -n 1 -f -w 5000 luna://com.webos.applicationManager/running '{}' >"$BASE/artwork-running.json"
/usr/bin/node -e 'var fs=require("fs"),r=JSON.parse(fs.readFileSync("/var/lib/webosbrew/reza-home-v1/artwork-running.json","utf8")),a=r.running.filter(function(a){return a.id==="com.webos.app.home"&&a.appType==="web";})[0];if(a&&/^\d+$/.test(a.webprocessid)){var cmd=fs.readFileSync("/proc/"+a.webprocessid+"/cmdline","utf8");if(cmd.indexOf("WebAppMgr")<0||cmd.indexOf("--type=renderer")<0)throw Error("Unexpected renderer");process.kill(Number(a.webprocessid),"SIGTERM");}'
sleep 2
luna-send -n 1 -f -w 5000 luna://com.webos.applicationManager/launch '{"id":"com.webos.app.home"}'
echo 'Personal Home 0.3.2 artwork upgrade installed.'
