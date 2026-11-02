// One-minute calibration during an explicit Home-button test. No text/audio.
var fs=require('fs'),fds=[],seen={};
fs.readFileSync('/proc/bus/input/devices','utf8').split('\n\n').forEach(function(b){
 if(!/Name="LGE (RCU|M-RCU|Simple)/.test(b))return;
 var m=/Handlers=.*\b(event\d+)\b/.exec(b);
 if(m)try{fds.push({name:m[1],fd:fs.openSync('/dev/input/'+m[1],fs.constants.O_RDONLY|fs.constants.O_NONBLOCK)});}catch(e){}
});
var buf=Buffer.alloc(16*64);
var timer=setInterval(function(){fds.forEach(function(d){var n;try{n=fs.readSync(d.fd,buf,0,buf.length,null);}catch(e){return;}
 for(var i=0;i+16<=n;i+=16){if(buf.readUInt16LE(i+8)!==1||buf.readInt32LE(i+12)!==1)continue;
 var code=buf.readUInt16LE(i+10),k=d.name+':'+code;seen[k]=(seen[k]||0)+1;}
});},40);
setTimeout(function(){clearInterval(timer);fds.forEach(function(d){fs.closeSync(d.fd);});console.log(JSON.stringify({test:'Physical Home calibration',seconds:60,events:seen}));},60000);
