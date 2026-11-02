#!/bin/sh
# Update only our own Home assets and its existing metadata updater.
set -eu
umask 077
BASE=/var/lib/webosbrew/reza-home-v1
CINEMA=/var/lib/webosbrew/reza-cinema-v1
SRC=/tmp/reza-collections-deploy
BACKUP=$BASE/before-collections-v1
test ! -e "$BASE/disabled"
test -f "$SRC/app/appinfo.json"
/usr/bin/node --check "$SRC/home-feed-refresh.js"
/usr/bin/node --check "$SRC/logo-analysis.js"
/usr/bin/node --check "$SRC/app/app.js"
/usr/bin/node --check "$SRC/app/collections.js"
systemctl stop reza-cinema-refresh.timer reza-cinema-refresh.service
if [ ! -d "$BACKUP" ]; then
  mkdir -m 700 "$BACKUP"
  cp -a "$BASE/app" "$BACKUP/app"
  cp -a /tmp/reza-home-app "$BACKUP/overlay"
  cp -a "$CINEMA" "$BACKUP/cinema"
fi
cp "$SRC/home-feed-refresh.js" "$CINEMA/home-feed-refresh.js"
cp "$SRC/logo-analysis.js" "$CINEMA/logo-analysis.js"
cp "$SRC/reza-cinema-refresh.service" "$SRC/reza-cinema-refresh.timer" "$CINEMA/"
cp "$SRC/runtime/collections-settings.json" "$SRC/runtime/collections-state.json" "$CINEMA/"
chmod 600 "$CINEMA/collections-settings.json" "$CINEMA/collections-state.json"
cp -a "$SRC/runtime/metadata-cache" "$CINEMA/"
cp -a "$SRC/runtime/collections" "$CINEMA/"
cp -a "$SRC/app/." "$BASE/app/"
cp "$SRC/com.reza.tvhome_0.3.0_all.ipk" /media/developer/temp/reza-personal-home.ipk
chmod 644 /media/developer/temp/reza-personal-home.ipk
luna-send -i -f -w 15000 luna://com.webos.appInstallService/dev/install '{"id":"com.reza.tvhome","ipkUrl":"/media/developer/temp/reza-personal-home.ipk","subscribe":true}' >"$BASE/collections-install.json"
/usr/bin/node -e 'var fs=require("fs"),a=JSON.parse(fs.readFileSync("/media/developer/apps/usr/palm/applications/com.reza.tvhome/appinfo.json","utf8"));if(a.version!=="0.3.0")throw Error("App installation incomplete");'
cp -a "$SRC/app/." /tmp/reza-home-app/
/usr/bin/node -e 'var fs=require("fs"),p="/tmp/reza-home-app/",a=JSON.parse(fs.readFileSync(p+"appinfo.json","utf8"));a.id="com.webos.app.home";a.title="Home";a.visible=false;a.defaultWindowType="card";a.noSplashOnLaunch=true;a.lockable=false;fs.writeFileSync(p+"appinfo.json",JSON.stringify(a,null,2));fs.appendFileSync(p+"config.js","\nwindow.HOME_CONFIG.systemHome = true;\n");'
find /tmp/reza-home-app -type d -exec chmod 755 '{}' \;
find /tmp/reza-home-app -type f -exec chmod 644 '{}' \;
/usr/bin/node "$CINEMA/home-feed-refresh.js" --publish-only
cp /var/lib/webosbrew/reza-weather-v1/public/feed.js /tmp/reza-home-app/weather/feed.js
cp /var/lib/webosbrew/reza-weather-v1/public/feed.js /media/developer/apps/usr/palm/applications/com.reza.tvhome/weather/feed.js
chmod 644 /tmp/reza-home-app/weather/feed.js /media/developer/apps/usr/palm/applications/com.reza.tvhome/weather/feed.js
cp "$CINEMA/reza-cinema-refresh.service" "$CINEMA/reza-cinema-refresh.timer" /run/systemd/system/
systemctl daemon-reload
systemctl start reza-cinema-refresh.timer
luna-send -n 1 -f -w 5000 luna://com.webos.applicationManager/running '{}' >"$BASE/collections-running.json"
/usr/bin/node -e 'var fs=require("fs"),r=JSON.parse(fs.readFileSync("/var/lib/webosbrew/reza-home-v1/collections-running.json","utf8")),a=r.running.filter(function(a){return a.id==="com.webos.app.home"&&a.appType==="web";})[0];if(a&&/^\d+$/.test(a.webprocessid)){var cmd=fs.readFileSync("/proc/"+a.webprocessid+"/cmdline","utf8");if(cmd.indexOf("WebAppMgr")<0||cmd.indexOf("--type=renderer")<0)throw Error("Unexpected Home renderer");process.kill(Number(a.webprocessid),"SIGTERM");}'
sleep 2
luna-send -n 1 -f -w 5000 luna://com.webos.applicationManager/launch '{"id":"com.webos.app.home"}'
echo 'Personal Home 0.3.0 installed; saved rollback and privacy controls preserved.'
