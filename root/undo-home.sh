#!/bin/sh
set -eu
BASE=/var/lib/webosbrew/reza-home-v1
DST=/usr/palm/applications/com.webos.app.home
touch "$BASE/disabled"
systemctl stop reza-cinema-refresh.timer reza-cinema-refresh.service 2>/dev/null || true
systemctl stop reza-weather-refresh.timer reza-weather-refresh.service 2>/dev/null || true
if [ "${1:-}" != --from-controller ]; then systemctl stop reza-home-control.service || true; fi
if grep -q " $DST " /proc/mounts; then umount "$DST"; fi
for pair in 'home-role.json roles.d' 'home-client.json client-permissions.d' 'home-manifest.json manifests.d'; do
  set -- $pair
  target="/var/luna-service2-dev/$2/com.reza.home-integration.json"
  if [ -f "$target" ] && cmp -s "$BASE/$1" "$target"; then rm "$target"; fi
done
ls-control scan-services
systemctl restart sam
systemctl restart webapp-mgr
luna-send -n 1 -f -w 5000 luna://com.webos.settingsservice/setSystemSettings "$(cat "$BASE/settings.restore.json")" >"$BASE/restore-result.json"
luna-send -n 1 -f -w 5000 luna://com.webos.applicationManager/launch '{"id":"com.webos.app.home"}' >/dev/null
echo 'LG Home restored. Personal Home startup disabled; privacy controls unchanged.'
