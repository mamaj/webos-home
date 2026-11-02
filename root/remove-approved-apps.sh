#!/bin/sh
set -eu
BASE=/var/lib/webosbrew/reza-app-backups-v1
[ ! -e "$BASE" ] || { echo 'App baseline exists; inspect instead of repeating removal.' >&2; exit 1; }
umask 077
mkdir -m 700 "$BASE"
for id in com.twin.app.gamingportal webos.day epoxyaisports; do
  luna-send -n 1 -f -w 5000 luna://com.webos.applicationManager/getAppInfo "{\"id\":\"$id\"}" >"$BASE/$id.info.json"
  /usr/bin/node -e 'var fs=require("fs"),id=process.argv[1],r=JSON.parse(fs.readFileSync("/var/lib/webosbrew/reza-app-backups-v1/"+id+".info.json","utf8")),a=r.appInfo;if(r.returnValue!==true||!a||a.id!==id||a.removable!==true||a.systemApp!==false||a.folderPath!=="/media/cryptofs/apps/usr/palm/applications/"+id)throw Error("Unexpected app: "+id);' "$id"
  tar -cf "$BASE/$id.app.tar" -C "/media/cryptofs/apps/usr/palm/applications/$id" .
  luna-send -i -f -w 8000 luna://com.webos.appInstallService/remove "{\"id\":\"$id\",\"subscribe\":true}" >"$BASE/$id.remove-result.json"
done
echo 'Removal requests sent for the three explicitly selected LG promotional apps; verify inventory.'
