// Filesystem-only state capture: no Node child-process calls on the C1 runtime.
var fs=require('fs'),p=fs.readFileSync('/var/run/reza-dropbear.pid','utf8').trim();
console.log(JSON.stringify({
 observedAt:new Date().toISOString(),uid:process.getuid(),
 bootId:fs.readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim(),
 uptimeSeconds:Number(fs.readFileSync('/proc/uptime','utf8').split(' ')[0]),
 bootTimeUnix:Number(/^btime (\d+)$/m.exec(fs.readFileSync('/proc/stat','utf8'))[1]),
 failsafe:fs.existsSync('/var/luna/preferences/webosbrew_failsafe'),
 startupExists:fs.existsSync('/var/lib/webosbrew/startup.sh'),
 developerAppPresent:fs.existsSync('/media/cryptofs/apps/usr/palm/applications/com.palmdts.devmode'),
 telnetDisabled:fs.existsSync('/var/luna/preferences/webosbrew_telnet_disabled'),
 keyOnly:fs.readFileSync('/proc/'+p+'/cmdline','utf8').split(String.fromCharCode(0)).indexOf('-s')>=0,
 homeDisabled:fs.existsSync('/var/lib/webosbrew/reza-home-v1/disabled'),
 homeHook:fs.existsSync('/var/lib/webosbrew/init.d/30-reza-home'),
 privacyHook:fs.existsSync('/var/lib/webosbrew/init.d/20-reza-privacy'),
 homeManifest:JSON.parse(fs.readFileSync('/usr/palm/applications/com.webos.app.home/appinfo.json','utf8'))
},null,2));
