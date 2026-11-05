// Only fixed maintenance commands; no shell text is accepted from the caller.
const path=require('node:path'),{spawnSync}=require('node:child_process');
const commands={
 status:'cat /tmp/reza-speaker-control/status.json',
 disable:'sh /var/lib/webosbrew/reza-speaker-v1/disable.sh',
 enable:'rm -f /var/lib/webosbrew/reza-speaker-v1/disabled && sh /var/lib/webosbrew/reza-speaker-v1/startup.sh',
 accept:'touch /tmp/reza-speaker-control/accepted && cp /var/lib/webosbrew/reza-speaker-v1/35-reza-speaker /var/lib/webosbrew/init.d/35-reza-speaker && chmod 755 /var/lib/webosbrew/init.d/35-reza-speaker'
};
if(!Object.hasOwn(commands,process.argv[2]))throw Error('Use status, disable, enable, or accept.');
const r=spawnSync(process.execPath,[path.resolve(__dirname,'../root-tv.cjs'),commands[process.argv[2]]],{stdio:'inherit'});if(r.error)throw r.error;process.exitCode=r.status||0;
