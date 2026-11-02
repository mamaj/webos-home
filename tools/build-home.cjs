// Package only the explicit app directory; never include .local-tv credentials.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const cli = path.join(root, '.tooling/node_modules/@webos-tools/cli/bin/ares-package.js');
if (!fs.existsSync(cli)) throw new Error('Install the pinned tools in .tooling first.');
const output = path.join(root, 'artifacts');
fs.mkdirSync(output, { recursive: true });
// The CLI supports APPDATA as its settings root. Scope that setting to this
// child process so it does not create or modify the user's global CLI profile.
const cliState = path.join(root, '.local-tv', 'cli-state');
fs.mkdirSync(cliState, { recursive: true, mode: 0o700 });
const stage = fs.mkdtempSync(path.join(root, '.local-tv', 'package-'));
try {
  const files = ['appinfo.json', 'index.html', 'app.js', 'config.js', 'style.css', 'icon.png', 'largeIcon.png'];
  const config = JSON.parse(fs.readFileSync(path.join(root,'personal-home/config.js'),'utf8').split('window.HOME_CONFIG = ')[1].replace(/;\s*$/, ''));
  for (const app of config.apps) {
    if (!app.icon) continue;
    if (!/^icons\/[a-z0-9._-]+\.(png|jpg)$/.test(app.icon)) throw Error('Invalid local icon path');
    if (!files.includes(app.icon)) files.push(app.icon);
  }
  files.push('fonts/outfit.ttf', 'fonts/Outfit-OFL.txt', 'tmdb-logo.svg', 'cinema/feed.js', 'weather/feed.js', 'collections.js', 'collections.css', 'collections/feed.js');
  const collections = JSON.parse(fs.readFileSync(path.join(root,'personal-home/collections/feed.js'),'utf8').split('window.HOME_DATA = ')[1].replace(/;\s*$/, ''));
  if ((collections.feed.items || []).length) throw Error('Never package personal watching history');
  for (const meta of Object.values(collections.enrichment || {})) for (const asset of [meta.logo, meta.backdrop, meta.thumbnail]) {
    if (!asset) continue;
    if (!/^collections\/assets\/(?:logo-(?:movie|tv)-\d+-[a-f0-9]{12}\.png|(?:backdrop|thumb)-(?:movie|tv)-\d+-[a-f0-9]{12}\.jpg)$/.test(asset)) throw Error('Invalid collection asset');
    if (!files.includes(asset)) files.push(asset);
  }
  const feed = JSON.parse(fs.readFileSync(path.join(root,'personal-home/cinema/feed.js'),'utf8').split('window.CINEMA_FEED = ')[1].replace(/;\s*$/, ''));
  for (const item of feed.items) {
    if (!/^cinema\/tmdb-(movie|tv)-\d+-[a-f0-9]{12}\.jpg$/.test(item.image)) throw Error('Invalid cached artwork path');
    if (!files.includes(item.image)) files.push(item.image);
  }
  for (const file of files) {
    const target = path.join(stage,file); fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.copyFileSync(path.join(root, 'personal-home', file),target);
  }
  const result = spawnSync(process.execPath, [cli, stage, '--outdir', output, '--no-minify'], { cwd: root, stdio: 'inherit', env: {...process.env, APPDATA:cliState} });
  if (result.error) throw result.error;
  process.exitCode = result.status || 0;
} finally {
  fs.rmSync(stage, { recursive: true });
}
