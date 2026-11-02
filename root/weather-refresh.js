// Fixed Toronto forecast request; Node 8 compatible. No geolocation or server.
'use strict';
var fs=require('fs'),path=require('path'),https=require('https');
var local=!!process.env.WEATHER_OUTPUT;
var base=local?path.resolve(process.env.WEATHER_OUTPUT):'/var/lib/webosbrew/reza-weather-v1/public';
function mkdir(p){if(fs.existsSync(p))return;mkdir(path.dirname(p));try{fs.mkdirSync(p,0o755);}catch(e){if(e.code!=='EEXIST')throw e;}}
function publish(data){
  var dirs=[base];
  if(!local)[['/var/lib/webosbrew/reza-home-v1/app','com.reza.tvhome'],['/media/developer/apps/usr/palm/applications/com.reza.tvhome','com.reza.tvhome'],['/tmp/reza-home-app','com.webos.app.home']].forEach(function(p){
    try{var a=JSON.parse(fs.readFileSync(p[0]+'/appinfo.json','utf8'));if(a.id===p[1]&&a.vendor==='Personal')dirs.push(p[0]+'/weather');}catch(e){}
  });
  var text='window.WEATHER_FEED = '+JSON.stringify(data).replace(/</g,'\\u003c')+';\n';
  dirs.forEach(function(d){mkdir(d);var p=path.join(d,'feed.js');fs.writeFileSync(p+'.new',text,{mode:0o644});fs.chmodSync(p+'.new',0o644);fs.renameSync(p+'.new',p);});
}
function get(){return new Promise(function(resolve,reject){
  var timer,req=https.get({hostname:'api.open-meteo.com',path:'/v1/forecast?latitude=43.6532&longitude=-79.3832&current=temperature_2m,weather_code,is_day&temperature_unit=celsius&timeformat=unixtime&forecast_days=1',headers:{Accept:'application/json','User-Agent':'PersonalHome/0.2'},agent:false},function(res){
    if(res.statusCode!==200){res.resume();return reject(Error('Weather HTTP '+res.statusCode));}
    var chunks=[],size=0;
    res.on('data',function(b){size+=b.length;if(size>65536){res.destroy();reject(Error('Weather response too large'));return;}chunks.push(b);});
    res.on('error',reject);res.on('end',function(){clearTimeout(timer);try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch(e){reject(e);}});
  });
  timer=setTimeout(function(){req.destroy(Error('Weather request timed out'));},15000);
  req.on('error',function(e){clearTimeout(timer);reject(e);});
});}
async function main(){
  if(!local&&fs.existsSync('/var/lib/webosbrew/reza-home-v1/disabled'))return;
  var data=await get(),c=data.current,now=Date.now();
  if(!c||typeof c.temperature_2m!=='number'||!isFinite(c.temperature_2m)||c.temperature_2m < -80||c.temperature_2m > 60||!Number.isInteger(c.weather_code)||c.weather_code<0||c.weather_code>99||[0,1].indexOf(c.is_day)<0||typeof c.time!=='number'||!isFinite(c.time)||Math.abs(now-c.time*1000)>2*3600000||!data.current_units||data.current_units.temperature_2m!=='°C')throw Error('Invalid weather data');
  var feed={version:1,city:'Toronto',temperature:c.temperature_2m,code:c.weather_code,isDay:c.is_day===1,observedAt:new Date(c.time*1000).toISOString(),updatedAt:new Date(now).toISOString(),source:'Open-Meteo'};
  publish(feed);console.log(JSON.stringify({refreshed:true,city:feed.city,temperature:feed.temperature,code:feed.code,observedAt:feed.observedAt}));
}
main().catch(function(){console.error('Weather refresh failed; previous cache retained.');process.exitCode=1;});
