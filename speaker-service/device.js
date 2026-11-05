// Fixed-purpose, identity-checked local UPnP client. Compatible with C1 Node 8.
'use strict';
var http=require('http'),dgram=require('dgram'),URL=require('url').URL;
function lan(host){if(!/^\d+\.\d+\.\d+\.\d+$/.test(host))return false;var p=host.split('.').map(Number);return p.every(function(n){return n>=0&&n<=255;})&&(p[0]===10||p[0]===192&&p[1]===168||p[0]===172&&p[1]>=16&&p[1]<=31);}
function field(xml,name){var m=new RegExp('<(?:[A-Za-z0-9_]+:)?'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[A-Za-z0-9_]+:)?'+name+'>').exec(xml);return m?m[1].trim():null;}
function request(host,port,route,method,body,headers){return new Promise(function(resolve,reject){
 if(!lan(host)||!Number.isInteger(port)||port<1||port>65535||route.charAt(0)!=='/')return reject(Error('Invalid local device'));
 var req=http.request({hostname:host,port:port,path:route,method:method||'GET',headers:headers||{},agent:false},function(res){var chunks=[],size=0;res.on('data',function(b){size+=b.length;if(size>262144)res.destroy(Error('Response limit'));else chunks.push(b);});res.on('error',reject);res.on('end',function(){if(res.statusCode!==200)return reject(Error('Speaker HTTP '+res.statusCode));var s=Buffer.concat(chunks).toString('utf8');if(/<!DOCTYPE|<!ENTITY/i.test(s))return reject(Error('Unsafe XML'));resolve(s);});});req.setTimeout(1500,function(){req.destroy(Error('Speaker timeout'));});req.on('error',reject);req.end(body||'');
});}
function Device(config,onLocation){if(!/^uuid:[A-Za-z0-9-]{8,100}$/.test(config.udn||''))throw Error('Missing speaker identity');this.udn=config.udn;this.host=config.host;this.port=config.port||49152;this.onLocation=onLocation||function(){};this.verified=false;}
Device.prototype.verify=async function(host,port){
 var xml=await request(host,port,'/description.xml');
 if(field(xml,'UDN')!==this.udn||field(xml,'manufacturer')!=='Edifier Inc'||field(xml,'modelName')!=='Edifier S1000W')throw Error('Speaker identity mismatch');
 this.host=host;this.port=port;this.verified=true;return true;
};
Device.prototype.discover=function(){var self=this;return new Promise(function(resolve,reject){
 var sock=dgram.createSocket('udp4'),done=false,checking={},timer;
 function finish(e){if(done)return;done=true;clearTimeout(timer);try{sock.close();}catch(ignore){}e?reject(e):resolve(true);}
 sock.on('error',finish);sock.on('message',function(buf){if(buf.length>8192)return;var raw=buf.toString(),u=/^usn:\s*([^\r\n]+)/im.exec(raw),m=/^location:\s*([^\r\n]+)/im.exec(raw);if(!u||u[1].split('::')[0].trim()!==self.udn||!m)return;try{var url=new URL(m[1].trim()),port=Number(url.port)||80;if(url.protocol!=='http:'||!lan(url.hostname)||url.username||url.password||checking[url.host])return;checking[url.host]=true;self.verify(url.hostname,port).then(function(){self.onLocation({host:self.host,port:self.port});finish();}).catch(function(){});}catch(e){}});
 sock.bind(0,function(){var b=Buffer.from('M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: "ssdp:discover"\r\nMX: 2\r\nST: urn:schemas-upnp-org:device:MediaRenderer:1\r\n\r\n');sock.send(b,1900,'239.255.255.250');});timer=setTimeout(function(){finish(Error('Speaker not found'));},4000);
 });};
Device.prototype.connect=async function(){try{return await this.verify(this.host,this.port);}catch(e){this.verified=false;return this.discover();}};
Device.prototype.soap=async function(service,action,args){
 var transport=service==='AVTransport',type='urn:schemas-upnp-org:service:'+service+':1',route=transport?'/upnp/control/rendertransport1':'/upnp/control/rendercontrol1';
 if(!((service==='RenderingControl'&&['GetVolume','GetMute','SetVolume','SetMute'].indexOf(action)>=0)||(transport&&action==='GetInfoEx')))throw Error('Unsupported speaker action');
 var contents='<InstanceID>0</InstanceID>'+(transport?'':'<Channel>Master</Channel>');Object.keys(args||{}).forEach(function(k){if(['DesiredVolume','DesiredMute'].indexOf(k)<0||!Number.isInteger(args[k])||args[k]<0||args[k]>100)throw Error('Invalid value');contents+='<'+k+'>'+args[k]+'</'+k+'>';});
 var body='<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><u:'+action+' xmlns:u="'+type+'">'+contents+'</u:'+action+'></s:Body></s:Envelope>';
 return request(this.host,this.port,route,'POST',body,{'Content-Type':'text/xml; charset="utf-8"','Content-Length':Buffer.byteLength(body),'SOAPACTION':'"'+type+'#'+action+'"'});
};
Device.prototype.status=async function(){
 if(!this.verified)await this.connect();
 var info=await this.soap('AVTransport','GetInfoEx'),mute=await this.soap('RenderingControl','GetMute');
 if(field(info,'CurrentVolume')===null)throw Error('Missing volume');
 var volume=Number(field(info,'CurrentVolume')),muted=field(mute,'CurrentMute'),mode=Number(field(info,'PlayType'));
 if(!Number.isInteger(volume)||volume<0||volume>100||['0','1'].indexOf(muted)<0)throw Error('Invalid speaker status');return {volume:volume,mute:muted==='1',input:mode===43?'Optical':'Speaker',inputCode:mode};
};
Device.prototype.setVolume=async function(n){if(!Number.isInteger(n)||n<0||n>100)throw Error('Invalid volume');await this.verify(this.host,this.port);await this.soap('RenderingControl','SetVolume',{DesiredVolume:n});};
Device.prototype.setMute=async function(value){if(typeof value!=='boolean')throw Error('Invalid mute');await this.verify(this.host,this.port);await this.soap('RenderingControl','SetMute',{DesiredMute:value?1:0});};
module.exports={Device:Device,field:field,lan:lan};
