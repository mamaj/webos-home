// Root SSH uses only this task's key and pinned host identity; no password fallback.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
let noTty = false, input;
while (args[0] === '--no-tty' || args[0] === '--input') {
  if (args.shift() === '--no-tty') noTty = true;
  else { input = fs.readFileSync(path.resolve(args.shift())); noTty = true; }
}
if (args.length !== 1) throw Error('Provide one explicit remote command.');
const result = spawnSync('ssh', ['-F','/dev/null','-i',path.join(root,'.local-tv/root_ed25519'),'-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','PreferredAuthentications=publickey','-o','PasswordAuthentication=no','-o','KbdInteractiveAuthentication=no','-o','StrictHostKeyChecking=yes','-o','UserKnownHostsFile='+path.join(root,'.local-tv/root_known_hosts'),'-o','ConnectTimeout=8','-o','LogLevel=ERROR',noTty?'-T':'-tt','root@'+require('./device-config.cjs')().host,args[0]], input === undefined ? {stdio:'inherit'} : {input,stdio:['pipe','inherit','inherit']});
if (result.error) throw result.error;
process.exitCode = result.status === null ? 1 : result.status;
