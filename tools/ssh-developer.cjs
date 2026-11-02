// Developer SSH with raw stdout/stderr for inspecting the jailed account.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const requireCli = createRequire(fs.realpathSync(path.join(root, '.tooling/node_modules/@webos-tools/cli/package.json')));
const { Client } = requireCli('ssh2');
const profiles = JSON.parse(fs.readFileSync(path.join(root, '.local-tv/cli-state/.webos/tv/novacom-devices.json'), 'utf8'));
const device = profiles.find(p => p.name === 'c1' && p.profile === 'tv');
if (!device || device.host !== require('./device-config.cjs')().host || device.username !== 'prisoner' || Number(device.port) !== 9922) throw Error('Unexpected developer device profile.');
const key = device.privateKey.openSsh;
if (!/^[a-zA-Z0-9_-]+$/.test(key)) throw Error('Unexpected key filename.');
const fingerprintPath = path.join(root, '.local-tv/developer-host-fingerprint');
let pinned;
try { pinned = fs.readFileSync(fingerprintPath, 'utf8').trim(); } catch {}
const connection = new Client();
const timeout = setTimeout(() => { console.error('Developer SSH command timed out.'); process.exitCode = 1; connection.destroy(); }, 20000);
connection.on('error', e => { console.error(e.message); process.exitCode = 1; clearTimeout(timeout); });
connection.on('ready', () => connection.exec(process.argv[2] || 'id', {pty:false}, (error, stream) => {
  if (error) { console.error(error.message); process.exitCode = 1; clearTimeout(timeout); return connection.end(); }
  stream.on('data', data => process.stdout.write(data.toString().replace(/\r/g, '')));
  stream.stderr.on('data', data => process.stderr.write(data.toString().replace(/\r/g, '')));
  stream.on('close', code => { process.exitCode = code || 0; clearTimeout(timeout); connection.end(); });
}));
connection.connect({host:device.host,port:9922,username:'prisoner',privateKey:fs.readFileSync(path.join(os.homedir(), '.ssh', key)),passphrase:device.passphrase,readyTimeout:8000,hostHash:'sha256',hostVerifier(hash) {
  if (pinned) return pinned === hash;
  fs.writeFileSync(fingerprintPath, hash + '\n', {mode:0o600}); return true;
}});
