"""Generate a local launcher catalog from the read-only TV inventory, without credentials."""
import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent
inventory = json.loads((root / '.local-tv/inventory.json').read_text())
brands = {
    'netflix': ('Netflix', 'red'), 'amazon': ('prime video', 'blue'),
    'youtube.leanback.v4': ('YouTube', 'white'), 'com.apple.appletv': ('Apple TV', 'dark'),
    'ca.bellmedia.crave': ('Crave', 'purple'), 'com.disney.disneyplus-prod': ('Disney+', 'blue'),
    'spotify-beehive': ('Spotify', 'green'), 'com.saba.filimo': ('Filimo', 'slate'),
    'com.bell.fibetv.production': ('Fibe TV', 'blue'), 'com.plutotv.app': ('pluto tv', 'white'),
    'com.webos.app.browser': ('Web Browser', 'green'),
}
apps = []
for item in inventory['apps']:
    if (item.get('removable') is not True and item['id'] != 'com.webos.app.browser') or item['id'] in {'com.reza.tvhome', 'com.palmdts.devmode'}:
        continue
    brand, theme = brands.get(item['id'], (item['title'], 'slate'))
    app = {'id': item['id'], 'title': item['title'], 'brand': brand, 'theme': theme}
    for extension in ['png', 'jpg']:
        icon = 'icons/' + item['id'] + '.' + extension
        if (root / 'personal-home' / icon).is_file():
            app['icon'] = icon
            break
    apps.append(app)
favorites = [key for key in ['netflix', 'amazon', 'youtube.leanback.v4', 'com.apple.appletv', 'com.webos.app.browser', 'com.disney.disneyplus-prod'] if any(a['id'] == key for a in apps)]
config = {'apps': apps, 'favorites': favorites}
encoded = json.dumps(config, ensure_ascii=True, indent=2).replace('<', '\\u003c')
(root / 'personal-home/config.js').write_text('// Local app catalog; contains no pairing credentials.\nwindow.HOME_CONFIG = ' + encoded + ';\n')
print(f'Generated catalog for {len(apps)} catalog apps and {len(favorites)} favorites.')
