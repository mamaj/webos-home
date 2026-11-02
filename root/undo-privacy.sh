#!/bin/sh
# Restores captured values and services. Does not remove root or change Home.
set -eu
BASE=/var/lib/webosbrew/reza-privacy-v1
[ "$(id -u)" = 0 ]
touch "$BASE/disabled"
for unit in voiceinput.service uploadd.service remotediag.service; do
  target="/etc/systemd/system/$unit"
  if grep -q " $target " /proc/mounts; then umount "$target"; fi
done
for unit in voiceinput.service voiceconductor.service uploadd.service rdxd.service remotelogger.service remotediag.service; do
  if [ -L "/run/systemd/system/$unit" ] && [ "$(readlink "/run/systemd/system/$unit")" = /dev/null ]; then
    systemctl unmask --runtime "$unit"
  fi
done
if grep -q ' /usr/sbin/uploadd ' /proc/mounts; then umount /usr/sbin/uploadd; fi
systemctl daemon-reload
for category in option general; do
  luna-send -n 1 -f -w 5000 luna://com.webos.settingsservice/setSystemSettings "$(cat "$BASE/$category.restore.json")"
done
if [ -f "$BASE/consent.restore.json" ]; then
  luna-send -n 1 -f -w 5000 luna://com.webos.settingsservice/setSystemSettings "$(cat "$BASE/consent.restore.json")"
fi
if [ -f "$BASE/active-before.list" ]; then
  while read -r unit; do systemctl --no-block start "$unit"; done <"$BASE/active-before.list"
fi
echo 'Restored saved privacy settings and previously active services. Privacy hook is disabled.'
