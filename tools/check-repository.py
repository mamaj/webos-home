"""Scan staged Git blobs without printing credentials or reading them into Git."""
from pathlib import Path
import json, re, subprocess, sys

root = Path(__file__).resolve().parent.parent

def git(*args):
    return subprocess.check_output(['git', *args], cwd=root)

known = set()
secret_keys = {'tmdbtoken', 'usertoken', 'passphrase', 'clientkey', 'apikey', 'access_token', 'refresh_token', 'password'}
def inspect_json(value):
    if isinstance(value, dict):
        for key, item in value.items():
            if key.lower() in secret_keys and isinstance(item, str) and len(item) >= 8:
                known.add(item.encode())
            else:
                inspect_json(item)
    elif isinstance(value, list):
        for item in value:
            inspect_json(item)

for file in (root / '.local-tv').rglob('*.json'):
    if file.stat().st_size > 4 * 1024 * 1024:
        continue
    try:
        inspect_json(json.loads(file.read_text()))
    except (ValueError, UnicodeError, OSError):
        pass

blocked = ('.local-tv/', 'artifacts/', 'audit/', 'cache/', 'node_modules/')
issues = []
files = git('ls-files', '-z').decode().split('\0')
for name in filter(None, files):
    if name.startswith(blocked) or '/node_modules/' in name or '__pycache__/' in name:
        issues.append((name, 'private/generated path'))
        continue
    data = git('show', ':' + name)
    if any(secret in data for secret in known):
        issues.append((name, 'matches local credential'))
    if re.search(rb'-----BEGIN (?:OPENSSH |RSA |EC |DSA )?PRIVATE KEY-----', data):
        issues.append((name, 'private key'))
    if re.search(rb'eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}', data):
        issues.append((name, 'JWT-shaped token'))
    if re.search(rb'/Users/[A-Za-z0-9_.-]+/', data):
        issues.append((name, 'personal absolute path'))
    if re.search(rb'\b192\.168\.\d{1,3}\.\d{1,3}\b', data):
        issues.append((name, 'hard-coded private LAN address'))
if issues:
    for name, reason in issues:
        print(f'FAIL {name}: {reason}')
    sys.exit(1)
print(f'PASS: {sum(bool(x) for x in files)} tracked files; no matched credentials or prohibited paths. Credential values were not printed.')
