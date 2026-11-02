// Use the project's pinned official CLI and private device configuration.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const commands = ['setup-device', 'novacom', 'device', 'device-info', 'install', 'launch', 'inspect', 'shell', 'pull', 'push'];
const command = process.argv[2];
if (!commands.includes(command)) {
  console.error('Usage: node tools/ares.cjs <' + commands.join('|') + '> [arguments]');
  process.exitCode = 1;
} else {
  const cli = path.join(root, '.tooling/node_modules/@webos-tools/cli/bin/ares-' + command + '.js');
  const state = path.join(root, '.local-tv/cli-state');
  fs.mkdirSync(state, {recursive:true, mode:0o700});
  const result = spawnSync(process.execPath, [cli, ...process.argv.slice(3)], {cwd:root, stdio:'inherit', env:{...process.env, APPDATA:state}});
  if (result.error) throw result.error;
  process.exitCode = result.status || 0;
}
