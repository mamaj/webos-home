// Temporary root broker over the existing developer connection, before migration to root SSH.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const command = process.argv[2];
if (!command) throw Error('Provide one explicit root command.');
const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
const remote = 'luna-send-pub -n 1 -w 15000 luna://org.webosbrew.hbchannel.service/exec ' + quote(JSON.stringify({command}));
const result = spawnSync(process.execPath, [path.join(__dirname, 'ssh-developer.cjs'), remote], {encoding:'utf8'});
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) throw result.error;
if (!result.stdout.trim()) throw Error('No root broker response; do not infer success.');
let response;
try { response = JSON.parse(result.stdout.trim()); } catch { throw Error('Unparseable root broker response.'); }
if (response.stdoutString) process.stdout.write(response.stdoutString);
if (response.stderrString) process.stderr.write(response.stderrString);
if (!response.returnValue) { console.error(response.errorText || 'Root command failed.'); process.exitCode = 1; }
