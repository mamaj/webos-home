#!/bin/sh
# Update only our app's reactivation handler; preserve the remote controller.
set -eu
umask 077
BASE=/var/lib/webosbrew/reza-home-v1
SRC=/tmp/reza-home-relaunch-fix
BACKUP=$BASE/before-relaunch-034
test ! -e "$BASE/disabled"
/usr/bin/node --check "$SRC/app.js"
if [ ! -d "$BACKUP" ]; then
 mkdir -m 700 "$BACKUP"
 cp "$BASE/app/app.js" "$BASE/app/appinfo.json" "$BACKUP/"
fi
for D in "$BASE/app" /media/developer/apps/usr/palm/applications/com.reza.tvhome /tmp/reza-home-app; do
 /usr/bin/node -e 'var fs=require("fs"),a=JSON.parse(fs.readFileSync(process.argv[1]+"/appinfo.json"));if(a.vendor!=="Personal"||["com.reza.tvhome","com.webos.app.home"].indexOf(a.id)<0)throw Error("Unexpected app");' "$D"
 cp "$SRC/app.js" "$D/app.js"
 /usr/bin/node -e 'var fs=require("fs"),p=process.argv[1]+"/appinfo.json",a=JSON.parse(fs.readFileSync(p));a.version="0.3.4";fs.writeFileSync(p,JSON.stringify(a,null,2));' "$D"
 chmod 644 "$D/app.js" "$D/appinfo.json"
done
luna-send -n 1 -f -w 5000 luna://com.webos.applicationManager/running '{}' >"$SRC/running.json"
/usr/bin/node -e 'var fs=require("fs"),r=JSON.parse(fs.readFileSync("/tmp/reza-home-relaunch-fix/running.json"));r.running.filter(function(a){return ["com.webos.app.home","com.reza.tvhome"].indexOf(a.id)>=0&&a.appType==="web";}).forEach(function(a){if(/^\d+$/.test(a.webprocessid)){var cmd=fs.readFileSync("/proc/"+a.webprocessid+"/cmdline","utf8");if(cmd.indexOf("WebAppMgr")<0||cmd.indexOf("--type=renderer")<0)throw Error("Unexpected renderer");process.kill(Number(a.webprocessid),"SIGTERM");}});'
sleep 1
luna-send -n 1 -f -w 5000 luna://com.webos.applicationManager/launch '{"id":"com.webos.app.home"}'
echo 'Personal Home 0.3.4 activation-state fix installed.'
