const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{Control}=require('../../speaker-service/control.js'),{field,lan,Device}=require('../../speaker-service/device.js');
const sleep=n=>new Promise(r=>setTimeout(r,n));
(async()=>{
 let time=10000,calls=[];const context={Qt:{Key_VolumeUp:1,Key_VolumeDown:2,Key_VolumeMute:3},KeyPolicy:{Accepted:1,NextPolicy:2},Date:{now:()=>time},lunaCall:{send:(...a)=>calls.push(a)}};vm.createContext(context);vm.runInContext(fs.readFileSync(require('path').resolve(__dirname,'../../speaker-service/key-filter.js'),'utf8'),context);
 context.personalSpeakerSend=(key,pressed)=>calls.push({key,pressed});
 function state(enabled,available=true){Object.assign(context.personalSpeaker,{enabled,available,seen:time});}
 state(false);assert.equal(context.personalSpeakerKey(1,true,false),2);assert.equal(context.personalSpeakerKey(3,true,false),1);time+=100;assert.equal(context.personalSpeakerKey(3,false,false),2);assert.equal(calls.length,0);
 context.personalSpeakerKey(3,true,false);time+=2000;state(false);assert.equal(context.personalSpeakerKey(3,false,false),1);assert.equal(calls.pop().key,'toggle');assert.equal(calls.length,0);
 state(true);context.personalSpeakerKey(1,true,false);context.personalSpeakerKey(1,false,false);assert.deepEqual(calls.map(a=>a.pressed),[true,false]);calls=[];
 context.personalSpeakerKey(3,true,false);time+=100;context.personalSpeakerKey(3,false,false);assert.equal(calls.pop().key,'mute');
 time+=3000;assert.equal(context.personalSpeakerKey(1,true,false),2);state(true,false);assert.equal(context.personalSpeakerKey(1,true,false),2);
 let actual=18,muted=false,changes=[],persisted=[],available=true;const device={verified:true,status:async()=>{if(!available)throw Error('offline');return {volume:actual,mute:muted,input:'Optical'};},setVolume:async n=>{actual=n;changes.push(n);},setMute:async v=>{muted=v;}};
 const c=new Control({device,enabled:true,persist:v=>persisted.push(v)});await c.refresh();c.key('up',true);c.key('up',false);await sleep(15);assert.equal(actual,23);
 c.key('down',true);await sleep(560);c.key('down',false);assert.ok(actual<=13);let stopped=actual;await sleep(200);assert.equal(actual,stopped);
 await c.toggleMute();assert.equal(actual,0);assert.equal(c.mute,true);assert.equal(c.restoreVolume,stopped);await c.toggleMute(true);assert.equal(actual,stopped);assert.equal(c.mute,false);c.toggle();assert.equal(c.enabled,false);c.key('up',true);await sleep(20);assert.equal(actual,stopped);assert.deepEqual(persisted,[false]);
 actual=100;c.enabled=true;await c.refresh();c.key('up',true);c.key('up',false);await sleep(15);assert.equal(actual,100);
 available=false;await c.refresh();assert.equal(c.available,false);c.key('down',true);assert.equal(c.held,null);assert.equal(c.pending,0);
 assert.equal(field('<CurrentVolume>18</CurrentVolume>','CurrentVolume'),'18');assert.equal(lan('127.0.0.1'),false);assert.equal(lan('8.8.8.8'),false);assert.equal(lan('10.1.2.3'),true);assert.throws(()=>new Device({udn:'invalid'}));
 let persistedMute=null;const recovered=new Control({device,enabled:true,restoreVolume:18,persist:()=>{},persistMute:n=>persistedMute=n});available=true;actual=0;await recovered.refresh();assert.equal(recovered.mute,true);assert.equal(recovered.volume,18);await recovered.toggleMute(true);assert.equal(actual,18);assert.equal(persistedMute,null);assert.equal(recovered.mute,false);
 console.log('PASS disabled LG fallback; short/long Mute; press/release/repeat; stale/offline fail-open; speaker write/readback, bounds and persistence.');
})().catch(e=>{console.error(e);process.exitCode=1;});
// The earlier accessibility policy must not arm LG's competing 2-second timer.
{
 let clock=10000,cancelled=0;const c={Qt:{Key_VolumeMute:3},Date:{now:()=>clock},longPressTimer:{isRunning:()=>true,cancel:()=>cancelled++}};
 vm.createContext(c);vm.runInContext(fs.readFileSync(require('path').resolve(__dirname,'../../speaker-service/accessibility-filter.js'),'utf8'),c);
 Object.assign(c.personalSpeakerAccess,{seen:clock,enabled:false,available:true});
 assert.equal(c.personalSpeakerAccessMute(3,true,false),true);clock+=2100;c.personalSpeakerAccess.seen=clock;
 assert.equal(c.personalSpeakerAccessSkipReset(3,false),true);assert.equal(c.personalSpeakerAccessMute(3,false,false),true);assert.ok(cancelled>0);
 clock+=100;Object.assign(c.personalSpeakerAccess,{seen:clock,enabled:false});c.personalSpeakerAccessMute(3,true,false);clock+=100;assert.equal(c.personalSpeakerAccessSkipReset(3,false),false);c.personalSpeakerAccessMute(3,false,false);
 c.personalSpeakerAccess.seen=0;clock+=3000;assert.equal(c.personalSpeakerAccessMute(3,true,false),false);assert.equal(c.personalSpeakerAccessMute(999,true,false),false);
 console.log('PASS competing LG guidance timer and triple-Mute reset are skipped only for owned/active controls; disabled short Mute and stale-service fallback remain native.');
}
