"""Prepare, but never run, a pinned root candidate with safe normal-boot access defaults."""
from pathlib import Path
import difflib
import hashlib
import json
import os
import re
import shlex
import shutil
import subprocess

root = Path(__file__).resolve().parent.parent
source = root / 'audit/slopbro'
expected = '21023d56ca424607bb03d2939609cc658c655fc7'
assert subprocess.check_output(['git', '-C', str(source), 'rev-parse', 'HEAD'], text=True).strip() == expected
assert not subprocess.check_output(['git', '-C', str(source), 'status', '--porcelain'], text=True).strip()
private = root / '.local-tv'
private.mkdir(mode=0o700, exist_ok=True)
key = private / 'root_ed25519'
if not key.exists():
    subprocess.run(['ssh-keygen', '-q', '-t', 'ed25519', '-N', '', '-C', 'webos-c1-local-control', '-f', str(key)], check=True)
os.chmod(key, 0o600)
public = key.with_suffix('.pub').read_text().strip()
assert re.fullmatch(r'ssh-ed25519 [A-Za-z0-9+/=]+ webos-c1-local-control', public)
expected_ipk = 'd10bf3c753551d7c72fb7a92b20fcd2317e502a220ac668ba8e76f6ea78b363c'
assert hashlib.sha256((private / 'homebrew-channel-0.7.3.ipk').read_bytes()).hexdigest() == expected_ipk
candidate = private / 'root-candidate-v2'
if candidate.exists():
    raise SystemExit('Candidate already exists; inspect it rather than overwriting it.')
(candidate / 'wwwroot').mkdir(parents=True, mode=0o700)
shutil.copy2(source / 'slopbro.py', candidate / 'slopbro.py')
for name in ['index.html', 'package.json', 'main.js']:
    shutil.copy2(source / 'wwwroot' / name, candidate / 'wwwroot' / name)
original = (source / 'wwwroot/autoroot.sh').read_text()
bootstrap = r'''
# Verify the reviewed release before any persistent local-access changes.
expected_ipk_sha256=EXPECTED_IPK_SHA256
actual_ipk_sha256="$(sha256sum "$ipk" | cut -d ' ' -f 1)"
[ "$actual_ipk_sha256" = "$expected_ipk_sha256" ] || { echo 'Homebrew package checksum mismatch; refusing installation'; exit 1; }

# Local preparation: no system partitions are rewritten. Root privileges required.
prepare_local_access() {
    [ "$(id -u)" = 0 ] || { echo 'Root access was not obtained'; exit 1; }
    baseline=/var/lib/webosbrew/reza-root-baseline-v1
    [ ! -e "$baseline" ] || { echo 'Existing root baseline: inspect before retry'; exit 1; }
    mkdir -p "$baseline" /home/root/.ssh /var/lib/webosbrew/init.d
    chmod 700 "$baseline" /home/root/.ssh
    if [ -f /home/root/.ssh/authorized_keys ]; then
        cp -p /home/root/.ssh/authorized_keys "$baseline/authorized_keys.orig"
    else
        touch "$baseline/authorized_keys.absent"
    fi
    for flag in webosbrew_telnet_disabled webosbrew_sshd_enabled; do
        if [ -e "/var/luna/preferences/$flag" ]; then
            [ -f "/var/luna/preferences/$flag" ] || { echo 'Unexpected flag type'; exit 1; }
            cp -p "/var/luna/preferences/$flag" "$baseline/$flag.orig"
        else
            touch "$baseline/$flag.absent"
        fi
    done
    public_key=PUBLIC_KEY_LITERAL
    grep -qxF "$public_key" /home/root/.ssh/authorized_keys 2>/dev/null || printf '\n%s\n' "$public_key" >>/home/root/.ssh/authorized_keys
    chmod 600 /home/root/.ssh/authorized_keys
    chown 0:0 /home/root/.ssh /home/root/.ssh/authorized_keys
    touch /var/luna/preferences/webosbrew_telnet_disabled
    rm -f /var/luna/preferences/webosbrew_sshd_enabled
    hook=/var/lib/webosbrew/init.d/10-reza-secure-ssh
    [ ! -e "$hook" ] || { echo 'Existing SSH hook: inspect before retry'; exit 1; }
    cat >"$hook" <<'SECURE_SSH_HOOK'
#!/bin/sh
mkdir -p /var/lib/webosbrew/sshd
exec /media/developer/apps/usr/palm/services/org.webosbrew.hbchannel.service/bin/dropbear -R -s -P /var/run/reza-dropbear.pid
SECURE_SSH_HOOK
    chmod 755 "$hook"
    chown 0:0 "$hook"
    sync
}

prepare_local_access
perform_root
'''.replace('PUBLIC_KEY_LITERAL', shlex.quote(public)).replace('EXPECTED_IPK_SHA256', shlex.quote(expected_ipk))
assert original.endswith('perform_root\n')
patched = original[:-len('perform_root\n')] + bootstrap
target = candidate / 'wwwroot/autoroot.sh'
target.write_text(patched)
subprocess.run(['bash', '-n', str(target)], check=True)
diff = ''.join(difflib.unified_diff(original.splitlines(True), patched.splitlines(True), fromfile='upstream/autoroot.sh', tofile='candidate/autoroot.sh'))
(candidate / 'autoroot-security.diff').write_text(diff)
files = ['slopbro.py', 'wwwroot/index.html', 'wwwroot/package.json', 'wwwroot/main.js', 'wwwroot/autoroot.sh']
manifest = {'upstreamCommit': expected, 'candidate': str(candidate), 'executedOnTV': False, 'homebrewReleaseSHA256':expected_ipk, 'files': {name:hashlib.sha256((candidate / name).read_bytes()).hexdigest() for name in files}}
(candidate / 'manifest.json').write_text(json.dumps(manifest, indent=2))
print('Prepared root candidate; nothing was executed on the TV.')
print('Review:', candidate / 'autoroot-security.diff')
print('Pinned source:', expected)
