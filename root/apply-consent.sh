#!/bin/sh
set -eu
BASE=/var/lib/webosbrew/reza-privacy-v1
INPUT=/tmp/reza-consent
[ ! -e "$BASE/consent.before.json" ] || { echo 'Consent baseline already exists; inspect before retry.' >&2; exit 1; }
luna-send -n 1 -f -w 5000 luna://com.webos.settingsservice/getSystemSettings '{"keys":["eulaStatus","eulaInfoNetwork"]}' >"$INPUT/current.json"
/usr/bin/node -e 'var fs=require("fs"),p="/tmp/reza-consent/",a=JSON.parse(fs.readFileSync(p+"current.json","utf8")),b=JSON.parse(fs.readFileSync(p+"consent-before-settings.json","utf8"));function stable(x){return x&&typeof x==="object"?(Array.isArray(x)?"["+x.map(stable).join(",")+"]":"{"+Object.keys(x).sort().map(function(k){return JSON.stringify(k)+":"+stable(x[k]);}).join(",")+"}"):JSON.stringify(x);}if(a.returnValue!==true||stable(a.settings)!==stable(b))throw Error("Consent changed since baseline; stop for a fresh review.");'
cp "$INPUT/current.json" "$BASE/consent.before.json"
cp "$INPUT/consent-restore.json" "$BASE/consent.restore.json"
luna-send -n 1 -f -w 5000 luna://com.webos.settingsservice/setSystemSettings "$(cat "$INPUT/consent-set.json")" >"$BASE/consent.set-result.json"
/usr/bin/node -e 'var r=JSON.parse(require("fs").readFileSync("/var/lib/webosbrew/reza-privacy-v1/consent.set-result.json","utf8"));if(r.returnValue!==true)throw Error("Consent write failed");'
# Backend deletion is a separate decision; this script only changes local consent.
echo 'Optional voice/viewing agreements withdrawn locally. Reboot still required.'
