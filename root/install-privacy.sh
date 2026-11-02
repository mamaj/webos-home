#!/bin/sh
set -eu
BASE=/var/lib/webosbrew/reza-privacy-v1
SRC=/tmp/reza-privacy-setup
UNITS='voiceinput.service voiceconductor.service uploadd.service rdxd.service remotelogger.service remotediag.service'
[ "$(id -u)" = 0 ]
[ ! -e "$BASE" ] || { echo 'Baseline already exists; inspect instead of reinstalling.' >&2; exit 1; }
for unit in $UNITS; do
  [ ! -e "/run/systemd/system/$unit" ] && [ ! -L "/run/systemd/system/$unit" ] || { echo "Existing runtime override: $unit" >&2; exit 1; }
done
! grep -q ' /usr/sbin/uploadd ' /proc/mounts
umask 077
mkdir -m 700 "$BASE"
for unit in $UNITS; do
  systemctl show "$unit" >"$BASE/$unit.before"
  if systemctl is-active --quiet "$unit"; then echo "$unit" >>"$BASE/active-before.list"; fi
done
luna-send -n 1 -f -w 5000 luna://com.webos.settingsservice/getSystemSettings '{"category":"option","keys":["livePlus","livePromotion","turnOnByVoice","dbgLogUpload","faultLogUpload","promotionStreamer","webOSPromotionVideo"]}' >"$BASE/option.before.json"
luna-send -n 1 -f -w 5000 luna://com.webos.settingsservice/getSystemSettings '{"category":"general","keys":["homePromotion","voiceLongDistance"]}' >"$BASE/general.before.json"
/usr/bin/node -e 'var fs=require("fs");["option","general"].forEach(function(c){var p="/var/lib/webosbrew/reza-privacy-v1/"+c;var r=JSON.parse(fs.readFileSync(p+".before.json","utf8"));if(r.returnValue!==true)throw Error("Incomplete baseline: "+c);fs.writeFileSync(p+".restore.json",JSON.stringify({category:c,settings:r.settings}));});'
cp "$SRC/20-reza-privacy" /var/lib/webosbrew/init.d/20-reza-privacy
cp "$SRC/undo-privacy.sh" "$BASE/undo.sh"
chmod 755 /var/lib/webosbrew/init.d/20-reza-privacy "$BASE/undo.sh"
luna-send -n 1 -f -w 5000 luna://com.webos.settingsservice/setSystemSettings '{"category":"option","settings":{"livePlus":"off","livePromotion":"off","turnOnByVoice":"off","dbgLogUpload":false,"faultLogUpload":false,"promotionStreamer":"off","webOSPromotionVideo":"off"}}' >"$BASE/option.set-result.json"
luna-send -n 1 -f -w 5000 luna://com.webos.settingsservice/setSystemSettings '{"category":"general","settings":{"homePromotion":"off","voiceLongDistance":"off"}}' >"$BASE/general.set-result.json"
/usr/bin/node -e 'var fs=require("fs");["option","general"].forEach(function(c){var r=JSON.parse(fs.readFileSync("/var/lib/webosbrew/reza-privacy-v1/"+c+".set-result.json","utf8"));if(r.returnValue!==true)throw Error("Setting update failed: "+c);});'
/var/lib/webosbrew/init.d/20-reza-privacy
echo 'Privacy controls applied; verify actual service and setting state.'
