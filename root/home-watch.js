// C1: 32-bit input_event records. Reads only; never grabs devices or logs keys.
// No sockets, subprocesses, microphone reads, or general command interface.
'use strict';
var fs=require('fs'), dir='/tmp/reza-home-control', fds=[], lastHome=0;
var blocks=fs.readFileSync('/proc/bus/input/devices','utf8').split('\n\n');
blocks.forEach(function(b){
  if(!/Name="LGE (RCU|M-RCU|Simple)/.test(b))return;
  var m=/Handlers=.*\b(event\d+)\b/.exec(b);
  if(m)try{fds.push(fs.openSync('/dev/input/'+m[1],fs.constants.O_RDONLY|fs.constants.O_NONBLOCK));}catch(e){}
});
if(!fds.length)throw Error('No LG remote input devices found');
var pipe=fs.openSync(dir+'/actions',fs.constants.O_WRONLY|fs.constants.O_NONBLOCK);
fs.writeFileSync(dir+'/watcher.json',JSON.stringify({pid:process.pid,devices:fds.length,eventBytes:16,homeCodes:[773],recovery:'Mac restore command; no multi-press shortcut'}));
function action(s){try{fs.writeSync(pipe,s+'\n');}catch(e){process.exit(1);}}
var buf=Buffer.alloc(16*32);
setInterval(function(){fds.forEach(function(fd){
  var n;try{n=fs.readSync(fd,buf,0,buf.length,null);}catch(e){if(e.code==='EAGAIN')return;process.exit(1);}
  for(var i=0;i+16<=n;i+=16){
    if(buf.readUInt16LE(i+8)!==1||buf.readInt32LE(i+12)!==1)continue;
    var code=buf.readUInt16LE(i+10);if(code!==773)continue;
    var now=Date.now();if(now-lastHome<180)continue;lastHome=now;
    setTimeout(function(){action('home');},250);
  }
});},50);
var previous=Date.now();
setInterval(function(){var now=Date.now(),gap=now-previous;previous=now;
  if(gap>10000){setTimeout(function(){action('home');},1500);setTimeout(function(){action('home');},3000);}
},1000);
