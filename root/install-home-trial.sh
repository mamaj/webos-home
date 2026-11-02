#!/bin/sh
set -eu
BASE=/var/lib/webosbrew/reza-home-v1
SRC=/tmp/reza-home-setup
[ "$(id -u)" = 0 ]
[ ! -e "$BASE" ] || { echo 'Home baseline already exists; inspect before retry.' >&2; exit 1; }
! grep -q ' /usr/palm/applications/com.webos.app.home ' /proc/mounts
umask 077
mkdir -m 700 "$BASE"
cp /usr/palm/applications/com.webos.app.home/appinfo.json "$BASE/stock-appinfo.json"
luna-send -n 1 -f -w 5000 luna://com.webos.settingsservice/getSystemSettings '{"category":"general","keys":["lastInputApp","physicalLastInputApp","homeAutoLaunch"]}' >"$BASE/settings.before.json"
/usr/bin/node -e 'var fs=require("fs"),p="/var/lib/webosbrew/reza-home-v1/",r=JSON.parse(fs.readFileSync(p+"settings.before.json","utf8"));if(r.returnValue!==true)throw Error("Missing Home baseline");fs.writeFileSync(p+"settings.restore.json",JSON.stringify({category:"general",settings:r.settings}));'
cp -a "$SRC/app" "$BASE/app"
for name in home-watch.js home-control.sh reza-home-control.service 30-reza-home home-role.json home-client.json home-manifest.json; do cp "$SRC/$name" "$BASE/$name"; done
cp "$SRC/undo-home.sh" "$BASE/undo.sh"
chmod 755 "$BASE/undo.sh" "$BASE/30-reza-home"
# Trial only: no persistent init hook or startup-setting change yet.
sh "$BASE/30-reza-home"
echo 'Home trial mounted. Persistent Home hook has not yet been installed.'
