"""Inspect the generated webOS archive, verify its exact source, and record its checksum."""
from pathlib import Path
import hashlib
import io
import json
import tarfile

root = Path(__file__).resolve().parent.parent
version = json.loads((root / 'personal-home/appinfo.json').read_text())['version']
package = root / ('artifacts/com.reza.tvhome_' + version + '_all.ipk')
raw = package.read_bytes()
assert raw[:8] == b'!<arch>\n'
offset, members = 8, {}
while offset < len(raw):
    header = raw[offset:offset + 60]
    assert header[58:60] == b'`\n'
    size = int(header[48:58])
    members[header[:16].decode().strip().rstrip('/')] = raw[offset + 60:offset + 60 + size]
    offset += 60 + size + size % 2
with tarfile.open(fileobj=io.BytesIO(members['data.tar.gz'])) as archive:
    files = {member.name: archive.extractfile(member).read() for member in archive.getmembers() if member.isfile()}
expected = {'app.js', 'appinfo.json', 'config.js', 'icon.png', 'index.html', 'largeIcon.png', 'style.css'}
config = json.loads((root / 'personal-home/config.js').read_text().split('window.HOME_CONFIG = ', 1)[1].rsplit(';', 1)[0])
expected.update(a['icon'] for a in config['apps'] if a.get('icon'))
feed = json.loads((root / 'personal-home/cinema/feed.js').read_text().split('window.CINEMA_FEED = ', 1)[1].rsplit(';', 1)[0])
expected.update({'cinema/feed.js', 'tmdb-logo.svg', 'weather/feed.js'})
expected.update(a['image'] for a in feed['items'])
collections = json.loads((root / 'personal-home/collections/feed.js').read_text().split('window.HOME_DATA = ', 1)[1].rsplit(';', 1)[0])
assert not collections['feed']['items'], 'Personal viewing history must not enter the package'
expected.update({'fonts/outfit.ttf', 'fonts/Outfit-OFL.txt'})
expected.update({'collections.js', 'collections.css', 'collections/feed.js'})
expected.update(asset for meta in collections['enrichment'].values() for asset in [meta.get('logo'), meta.get('backdrop'), meta.get('thumbnail')] if asset)
application_files = {name.split('/applications/', 1)[1].split('/', 1)[1] for name in files if '/applications/' in name}
assert application_files == expected, application_files
assert all(not any(word in name for word in ['.local-tv', 'key', 'service', 'README']) for name in files)
for name, content in files.items():
    if '/applications/' in name:
        relative = name.split('/applications/', 1)[1].split('/', 1)[1]
        assert content == (root / 'personal-home' / relative).read_bytes(), name
manifest = json.loads(next(content for name, content in files.items() if name.endswith('/appinfo.json')))
assert manifest['id'] == 'com.reza.tvhome'
assert b"connect-src 'none'" in next(content for name, content in files.items() if name.endswith('/index.html'))
settings_file = root / '.local-tv/cinema-settings.json'
if settings_file.exists():
    token = json.loads(settings_file.read_text()).get('tmdbToken', '').encode()
    assert token and all(token not in content for content in files.values()), 'Private token leaked into package'
session_file = root / '.local-tv/30nama-connector/session.json'
if session_file.exists():
    session = json.loads(session_file.read_text())['usertoken'].encode()
    assert session and all(session not in content for content in files.values()), 'Account session leaked into package'
report = {'package': package.name, 'sha256': hashlib.sha256(raw).hexdigest(), 'applicationFiles': sorted(application_files), 'credentialFiles': False, 'serviceFiles': False, 'sourceMatchesPackage': True, 'manifest': manifest}
(root / 'artifacts/package-checks.json').write_text(json.dumps(report, indent=2))
(root / 'artifacts/SHA256SUMS').write_text(report['sha256'] + '  ' + package.name + '\n')
print(json.dumps(report, indent=2))
