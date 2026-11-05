// Run on the TV during the guarded trial. Restores volume, mute and control mode.
'use strict';
var fs=require('fs'),http=require('http'),cp=require('child_process'),Device=require('/var/lib/webosbrew/reza-speaker-v1/device.js').Device;
var BASE='/var/lib/webosbrew/reza-speaker-v1',config=JSON.parse(fs.readFileSync(BASE+'/settings.json')),device=new Device(config);
function wait(ms){return new Promise(function(r){setTimeout(r,ms);});}
function api(route,obj){return new Promise(function(resolve,reject){var body=obj?JSON.stringify(obj):'',req=http.request({hostname:'127.0.0.1',port:41273,path:'/'+route,method:obj?'POST':'GET',headers:{'X-Speaker-Control':config.controlToken,'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}},function(res){var s='';res.on('data',function(b){s+=b;});res.on('end',function(){try{if(res.statusCode!==200)throw Error('API status '+res.statusCode);resolve(JSON.parse(s));}catch(e){reject(e);}});});req.setTimeout(2500,function(){req.destroy(Error('Local channel timeout'));});req.on('error',reject);req.end(body);});}
function luna(uri,payload){var command='/usr/bin/luna-send -n 1 -w 5000 '+uri+" '"+JSON.stringify(payload)+"'",out=cp.execFileSync('/usr/bin/script',['-q','-c',command,'/dev/null'],{timeout:7000}).toString().replace(/\r/g,'').trim();return JSON.parse(out.slice(out.indexOf('{'),out.lastIndexOf('}')+1));}
function inject(key,hold){cp.execFileSync('/usr/bin/python2.7',[BASE+'/inject-audio-test.py',String(key),String(hold)],{timeout:5000});}
function check(condition,message){if(!condition)throw Error(message);}
(async function(){var before,mode=false,nativeBefore,report={};
 try{
  await device.connect();before=await device.status();mode=(await api('status')).enabled;check(mode===false,'Run the guarded test with control off');
  nativeBefore=luna('luna://com.webos.service.audio/master/getVolume',{}).volumeStatus;
  var foreground=luna('luna://com.webos.applicationManager/getForegroundAppInfo',{}).appId;
  inject(113,2100);await wait(1800);check((await api('status')).enabled===true,'Long Mute did not enable control');report.longMuteEnables=true;
  inject(115,80);await wait(600);report.volumeBaseline=before.volume;report.volumeAfterUp=(await device.status()).volume;check(report.volumeAfterUp===Math.min(100,before.volume+5),'Volume Up not applied once');report.volumeUp=true;
  inject(114,80);await wait(600);check((await device.status()).volume===before.volume,'Volume Down not applied once');report.volumeDown=true;
  inject(113,80);await wait(600);check((await device.status()).volume===0&&(await api('status')).mute===true,'Short Mute did not silence speaker');inject(113,80);await wait(600);check((await device.status()).volume===before.volume&&(await api('status')).mute===false,'Second short Mute did not restore volume');report.shortMute=true;
  inject(115,680);await wait(600);check((await device.status()).volume>Math.min(100,before.volume+5),'Held volume did not repeat');report.heldVolume=true;
  await device.setVolume(before.volume);
  inject(113,2100);await wait(1800);check((await api('status')).enabled===false,'Long Mute did not disable control');report.longMuteDisables=true;
  var metrics=JSON.parse(fs.readFileSync('/tmp/reza-speaker-control/metrics.json'));var count=metrics.keyEvents;
  inject(115,80);await wait(400);inject(114,80);await wait(400);check(JSON.parse(fs.readFileSync('/tmp/reza-speaker-control/metrics.json')).keyEvents===count,'Disabled volume keys still sent to speaker service');report.disabledKeysUseLg=true;
  var after=luna('luna://com.webos.applicationManager/getForegroundAppInfo',{}).appId;report.foregroundPreserved=foreground===after;report.foregroundBefore=foreground;report.foregroundAfter=after;check(report.foregroundPreserved,'Overlay or guidance changed foreground app');
 }catch(e){report.error=e.message;process.exitCode=1;}
 finally{
  try{var s=await api('status');if(s.enabled!==mode)await api('key',{key:'toggle',pressed:true});}catch(e){}
  if(nativeBefore)try{var current=luna('luna://com.webos.service.audio/master/getVolume',{}).volumeStatus;if(current.muteStatus!==nativeBefore.muteStatus)luna('luna://com.webos.audio/setMute',{mute:nativeBefore.muteStatus});}catch(e){}
  if(before)try{await device.setVolume(before.volume);await device.setMute(before.mute);var restored=await device.status();report.speakerStateRestored=restored.volume===before.volume&&restored.mute===before.mute;}catch(e){report.speakerStateRestored=false;process.exitCode=1;}
  fs.writeFileSync(BASE+'/automated-trial.json',JSON.stringify(report,null,2),{mode:0o600});console.log(JSON.stringify(report));
 }
})();
