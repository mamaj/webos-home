#!/bin/sh
set -eu
BASE=/var/lib/webosbrew/reza-home-v1
[ "$(id -u)" = 0 ]
rm -f "$BASE/disabled"
cp "$BASE/30-reza-home" /var/lib/webosbrew/init.d/30-reza-home
chmod 755 /var/lib/webosbrew/init.d/30-reza-home
luna-send -n 1 -f -w 5000 luna://com.webos.settingsservice/setSystemSettings '{"category":"general","settings":{"lastInputApp":"com.reza.tvhome","physicalLastInputApp":"com.reza.tvhome","homeAutoLaunch":"off"}}' >"$BASE/startup-set-result.json"
/usr/bin/node -e 'var r=JSON.parse(require("fs").readFileSync("/var/lib/webosbrew/reza-home-v1/startup-set-result.json","utf8"));if(r.returnValue!==true)throw Error("Home startup setting failed");'
sh "$BASE/30-reza-home"
echo 'Personal Home is enabled for Home and startup. Privacy controls unchanged.'
