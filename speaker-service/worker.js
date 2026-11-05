// Authenticated loopback-only audio IPC and fixed UPnP actions; no command API.
'use strict';
var fs=require('fs'),path=require('path'),cp=require('child_process'),http=require('http'),crypto=require('crypto'),Device=require('./device.js').Device,Control=require('./control.js').Control;
var BASE='/var/lib/webosbrew/reza-speaker-v1',RUN='/tmp/reza-speaker-control';
function read(p){try{return JSON.parse(fs.readFileSync(p,'utf8'));}catch(e){return null;}}
function write(p,obj){var t=p+'.new';fs.writeFileSync(t,JSON.stringify(obj),{mode:0o600});fs.renameSync(t,p);}
if(fs.existsSync(BASE+'/disabled'))process.exit(0);
if(!fs.existsSync(RUN))fs.mkdirSync(RUN,0o700);fs.chmodSync(RUN,0o700);
var config=read(BASE+'/settings.json');if(!config)throw Error('Speaker settings missing');var cached=read(BASE+'/device-cache.json')||{},device=new Device({udn:config.udn,host:cached.host||config.host,port:cached.port||config.port},function(location){write(BASE+'/device-cache.json',location);});
if(!/^[a-f0-9]{64}$/.test(config.controlToken||''))throw Error('Missing local capability token');
function shellQuote(s){return "'"+s.replace(/'/g,"'\\''")+"'";}
var showing=false,nextOverlay=null,lastOverlay=0;
function overlay(data){nextOverlay=data;if(showing)return;var delay=Math.max(0,130-(Date.now()-lastOverlay));showing=true;setTimeout(function(){var value=nextOverlay;nextOverlay=null;lastOverlay=Date.now();var payload=JSON.stringify({id:'com.reza.speakerosd',params:value}),command='/usr/bin/luna-send -n 1 -w 4000 luna://com.webos.applicationManager/launch '+shellQuote(payload);cp.execFile('/usr/bin/script',['-q','-c',command,'/dev/null'],{timeout:5000,maxBuffer:16384},function(){showing=false;if(nextOverlay)overlay(nextOverlay);});},delay);}
var state={},controller=new Control({device:device,enabled:config.enabled,restoreVolume:config.softMuteVolume,persistMute:function(n){config=Object.assign(config,read(BASE+'/settings.json')||{},{softMuteVolume:n});write(BASE+'/settings.json',config);},persist:function(enabled){config=Object.assign(config,read(BASE+'/settings.json')||{},{enabled:enabled});write(BASE+'/settings.json',config);},publish:function(s){state=s;write(RUN+'/status.json',Object.assign({updatedAt:Date.now()},s));},notify:overlay});
controller.emit();var metrics={statusRequests:0,keyEvents:0,lastStatusAt:0};function record(){write(RUN+'/metrics.json',metrics);}
var server=http.createServer(function(req,res){
 var token=req.headers['x-speaker-control']||'',valid=typeof token==='string'&&/^[a-f0-9]{64}$/.test(token)&&crypto.timingSafeEqual(Buffer.from(token),Buffer.from(config.controlToken));
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
 function send(code,obj){res.writeHead(code);res.end(JSON.stringify(obj));}
 if(req.headers.host!=='127.0.0.1:41273'||!valid){send(403,{returnValue:false});return;}
 if(req.method==='GET'&&req.url==='/status'){metrics.statusRequests++;metrics.lastStatusAt=Date.now();record();send(200,Object.assign({returnValue:true},controller.snapshot()));return;}
 if(req.method!=='POST'||req.url!=='/key'||!/^application\/json(?:;|$)/.test(req.headers['content-type']||'')||Number(req.headers['content-length'])>256){send(404,{returnValue:false});return;}
 req.on('error',function(){});var body='';req.on('data',function(b){body+=b.toString();if(body.length>256)req.destroy();});req.on('end',function(){try{var a=JSON.parse(body);if(['up','down','mute','toggle'].indexOf(a.key)<0||typeof a.pressed!=='boolean'||Object.keys(a).length!==2)throw Error();metrics.keyEvents++;metrics.lastKey=a.key;metrics.lastKeyAt=Date.now();metrics.recent=metrics.recent||[];metrics.recent.push({key:a.key,pressed:a.pressed,at:Date.now()});if(metrics.recent.length>12)metrics.recent.shift();record();controller.key(a.key,a.pressed);send(200,Object.assign({returnValue:true},controller.snapshot()));}catch(e){send(400,{returnValue:false});}});
});
server.on('error',function(){process.exitCode=1;shutdown();});server.listen(41273,'127.0.0.1');
var heartbeat=setInterval(function(){controller.emit();},1000),poll=setInterval(function(){controller.refresh();},2000);controller.refresh();
var closing=false;function shutdown(){if(closing)return;closing=true;controller.stopHold();clearInterval(heartbeat);clearInterval(poll);try{server.close();}catch(e){}process.exit(process.exitCode||0);}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);process.on('uncaughtException',function(){process.exitCode=1;shutdown();});
