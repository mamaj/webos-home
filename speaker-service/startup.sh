#!/bin/sh
# Private RAM overlays only; all LG files on flash retain their original bytes.
set -eu
BASE=/var/lib/webosbrew/reza-speaker-v1
DIR=/usr/lib/qml/KeyFilters
PLUGIN=/usr/lib/plugins/platforms/libqstarfishegl.so
[ ! -e "$BASE/disabled" ] || exit 0
/usr/bin/node --check "$BASE/worker.js"
/usr/bin/node --check "$BASE/systemUi.patched.js"
/usr/bin/node --check "$BASE/appLaunch.patched.js"
/usr/bin/node -e 'var fs=require("fs"),c=require("crypto"),s=JSON.parse(fs.readFileSync("/var/lib/webosbrew/reza-speaker-v1/settings.json"));function hash(p){return c.createHash("sha256").update(fs.readFileSync(p)).digest("hex");}[["systemUi.js","keyFilterSha256","personalSpeakerKey"],["appLaunch.js","appLaunchSha256","personalSpeakerAccessMute"]].forEach(function(a){var p="/usr/lib/qml/KeyFilters/"+a[0];if(fs.readFileSync(p).toString().indexOf(a[2])>=0)return;if(hash(p)!==s[a[1]])throw Error("Key-filter firmware changed; hook not applied");});var h=hash("/usr/lib/qt5/plugins/platforms/libqstarfishegl.so");if(h!==s.qpaSha256&&h!==s.qpaPatchedSha256)throw Error("Keyboard firmware changed; hook not applied");if(hash("/var/lib/webosbrew/reza-speaker-v1/qpa-speaker.so")!==s.qpaPatchedSha256)throw Error("Invalid keyboard RAM overlay");'
cp "$BASE/reza-speaker.service" /run/systemd/system/reza-speaker.service
systemctl daemon-reload
systemctl reset-failed reza-speaker.service || true
systemctl start reza-speaker.service
changed=0
trap 'sh "$BASE/disable.sh" || true' 1 2 15
for name in systemUi appLaunch; do
 if ! grep -q " $DIR/$name.js " /proc/mounts; then
  mount --bind "$BASE/$name.patched.js" "$DIR/$name.js" || { sh "$BASE/disable.sh";exit 1; }
  changed=1
 fi
done
if ! grep -q " $PLUGIN " /proc/mounts; then
 mount --bind "$BASE/qpa-speaker.so" "$PLUGIN" || { sh "$BASE/disable.sh";exit 1; }
 changed=1
fi
if [ "$changed" = 1 ]; then
 if ! systemctl restart surface-manager; then sh "$BASE/disable.sh";exit 1;fi
fi
