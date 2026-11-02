"""Observe one approved reboot until the same pinned SSH identity returns as root."""
from pathlib import Path
import datetime
import json
import shlex
import subprocess
import time

root = Path(__file__).resolve().parent.parent
import sys, os
try:
    device = json.loads((root / ".local-tv/device.json").read_text())
except FileNotFoundError:
    device = {}
host = os.environ.get("TV_HOST") or device.get("host")
if not host or any(c not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-" for c in host):
    raise SystemExit("Invalid TV host")
baseline_name = sys.argv[1] if len(sys.argv) == 2 else 'root-preboot.json'
if '/' in baseline_name or not baseline_name.endswith('.json'):
    raise SystemExit('Use a baseline filename inside .local-tv.')
baseline_path = root / '.local-tv' / baseline_name
before = json.loads(baseline_path.read_text())
js = "var fs=require('fs');var p=fs.readFileSync('/var/run/reza-dropbear.pid','utf8').trim();if(!/^[0-9]+$/.test(p))throw Error('Invalid SSH pid');var args=fs.readFileSync('/proc/'+p+'/cmdline','utf8').split(String.fromCharCode(0));console.log(JSON.stringify({uid:process.getuid(),bootId:fs.readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim(),failsafe:fs.existsSync('/var/luna/preferences/webosbrew_failsafe'),startupExists:fs.existsSync('/var/lib/webosbrew/startup.sh'),developerAppPresent:fs.existsSync('/media/cryptofs/apps/usr/palm/applications/com.palmdts.devmode'),telnetDisabled:fs.existsSync('/var/luna/preferences/webosbrew_telnet_disabled'),keyOnly:args.indexOf('-s')>=0}));"
args = ['ssh','-F','/dev/null','-i',str(root/'.local-tv/root_ed25519'),'-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','PreferredAuthentications=publickey','-o','PasswordAuthentication=no','-o','KbdInteractiveAuthentication=no','-o','StrictHostKeyChecking=yes','-o','UserKnownHostsFile='+str(root/'.local-tv/root_known_hosts'),'-o','ConnectTimeout=5','-o','LogLevel=ERROR','-T','root@' + host,'/usr/bin/node -e '+shlex.quote(js)]
js = js.replace('uid:process.getuid(),', "uid:process.getuid(),uptimeSeconds:Number(fs.readFileSync('/proc/uptime','utf8').split(' ')[0]),bootTimeUnix:Number(fs.readFileSync('/proc/stat','utf8').split(String.fromCharCode(10)).filter(function(s){return s.indexOf('btime ')===0;})[0].split(' ')[1]),")
args[-1] = '/usr/bin/node -e ' + shlex.quote(js)
deadline = time.monotonic() + 150
announced = False
while time.monotonic() < deadline:
    try:
        result = subprocess.run(args, capture_output=True, text=True, timeout=9)
    except subprocess.TimeoutExpired:
        time.sleep(3)
        continue
    if 'HOST IDENTIFICATION HAS CHANGED' in result.stderr or 'Host key verification failed' in result.stderr:
        raise SystemExit('SSH identity changed; stopped for investigation.')
    if result.returncode == 0:
        state = json.loads(result.stdout)
        # This C1 reused its boot ID across a verified restart. Also compare
        # kernel uptime and boot time captured in the immediately prior baseline.
        new_boot = state['bootId'] != before['bootId']
        if 'uptimeSeconds' in before and 'bootTimeUnix' in before:
            new_boot = new_boot or (state['uptimeSeconds'] < before['uptimeSeconds'] - 10 and state['bootTimeUnix'] > before['bootTimeUnix'] + 10)
        if new_boot and state['uid'] == 0:
            if not announced:
                print('Root SSH returned after a new boot; checking startup completion.', flush=True)
                announced = True
            if not state['failsafe'] and state['startupExists'] and not state['developerAppPresent'] and state['telnetDisabled'] and state['keyOnly']:
                state['observedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
                (root/'.local-tv/root-postboot.json').write_text(json.dumps(state, indent=2))
                print('VERIFIED: new boot, UID 0, pinned host key, password-disabled SSH, normal startup, Developer Mode removed.', flush=True)
                break
    time.sleep(3)
else:
    raise SystemExit('Reboot observation timed out; inspect the current TV state before any retry.')
