#!/bin/sh
set -eu
BASE=/var/lib/webosbrew/reza-speaker-v1
DIR=/usr/lib/qml/KeyFilters
touch "$BASE/disabled"
systemctl stop reza-speaker.service || true
/usr/bin/node -e 'var fs=require("fs"),p="/var/lib/webosbrew/reza-speaker-v1/settings.json",s=JSON.parse(fs.readFileSync(p));s.enabled=false;fs.writeFileSync(p+".new",JSON.stringify(s),{mode:384});fs.renameSync(p+".new",p);'
for name in systemUi appLaunch; do
 if grep -q " $DIR/$name.js " /proc/mounts; then umount "$DIR/$name.js";fi
done
PLUGIN=/usr/lib/plugins/platforms/libqstarfishegl.so
while grep -q " $PLUGIN " /proc/mounts; do umount -l "$PLUGIN";done
printf '%s\n' 'Speaker control stopped. Original LG audio handling and guidance shortcut are restored.'
