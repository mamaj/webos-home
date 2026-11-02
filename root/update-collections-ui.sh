#!/bin/sh
set -eu
umask 077
BASE=/var/lib/webosbrew/reza-home-v1
SRC=/tmp/reza-collections-ui
test ! -e "$BASE/disabled"
/usr/bin/node --check "$SRC/collections.js"
if [ ! -d "$BASE/before-collections-performance-v1" ]; then
  mkdir -m 700 "$BASE/before-collections-performance-v1"
  cp "$BASE/app/app.js" "$BASE/app/collections.js" "$BASE/app/collections.css" "$BASE/app/appinfo.json" "$BASE/before-collections-performance-v1/"
fi
cp "$SRC/app.js" "$SRC/collections.js" "$SRC/collections.css" "$SRC/appinfo.json" "$BASE/app/"
cp "$SRC/com.reza.tvhome_0.3.1_all.ipk" /media/developer/temp/reza-personal-home.ipk
chmod 644 /media/developer/temp/reza-personal-home.ipk
luna-send -i -f -w 15000 luna://com.webos.appInstallService/dev/install '{"id":"com.reza.tvhome","ipkUrl":"/media/developer/temp/reza-personal-home.ipk","subscribe":true}' >"$BASE/collections-performance-install.json"
/usr/bin/node -e 'var fs=require("fs"),a=JSON.parse(fs.readFileSync("/media/developer/apps/usr/palm/applications/com.reza.tvhome/appinfo.json","utf8"));if(a.version!=="0.3.1")throw Error("App update incomplete");'
cp "$SRC/app.js" "$SRC/collections.js" "$SRC/collections.css" /tmp/reza-home-app/
/usr/bin/node -e 'var fs=require("fs"),p="/tmp/reza-home-app/appinfo.json",a=JSON.parse(fs.readFileSync(p,"utf8"));if(a.id!=="com.webos.app.home"||a.vendor!=="Personal")throw Error("Unexpected Home manifest");a.version="0.3.1";fs.writeFileSync(p,JSON.stringify(a,null,2));'
find /tmp/reza-home-app -type d -exec chmod 755 '{}' \;
find /tmp/reza-home-app -type f -exec chmod 644 '{}' \;
/usr/bin/node /var/lib/webosbrew/reza-cinema-v1/home-feed-refresh.js --publish-only
cp /var/lib/webosbrew/reza-weather-v1/public/feed.js /media/developer/apps/usr/palm/applications/com.reza.tvhome/weather/feed.js
chmod 644 /media/developer/apps/usr/palm/applications/com.reza.tvhome/weather/feed.js
luna-send -n 1 -f -w 5000 luna://com.webos.applicationManager/running '{}' >"$BASE/collections-performance-running.json"
/usr/bin/node -e 'var fs=require("fs"),r=JSON.parse(fs.readFileSync("/var/lib/webosbrew/reza-home-v1/collections-performance-running.json","utf8")),a=r.running.filter(function(a){return a.id==="com.webos.app.home"&&a.appType==="web";})[0];if(a&&/^\d+$/.test(a.webprocessid)){var cmd=fs.readFileSync("/proc/"+a.webprocessid+"/cmdline","utf8");if(cmd.indexOf("WebAppMgr")<0||cmd.indexOf("--type=renderer")<0)throw Error("Unexpected renderer");process.kill(Number(a.webprocessid),"SIGTERM");}'
sleep 2
luna-send -n 1 -f -w 5000 luna://com.webos.applicationManager/launch '{"id":"com.webos.app.home"}'
echo 'Personal Home 0.3.1 performance update installed.'
