// Fixed HTTPS client and local cache writer; compatible with the C1's Node 8.
// No HTTP server, shell commands, viewing history, or user-specific requests.
'use strict';
var fs=require('fs'),path=require('path'),https=require('https'),crypto=require('crypto'),URL=require('url').URL;
var local=!!process.env.CINEMA_OUTPUT;
var base=local?path.resolve(process.env.CINEMA_OUTPUT):'/var/lib/webosbrew/reza-cinema-v1/public';
var settingsPath=process.env.CINEMA_SETTINGS||'/var/lib/webosbrew/reza-cinema-v1/settings.json';
function mkdir(p){if(fs.existsSync(p))return;mkdir(path.dirname(p));try{fs.mkdirSync(p,0o755);}catch(e){if(e.code!=='EEXIST')throw e;}}
function atomic(p,data){var t=p+'.new';fs.writeFileSync(t,data,{mode:0o644});fs.chmodSync(t,0o644);fs.renameSync(t,p);}
function script(data){return 'window.CINEMA_FEED = '+JSON.stringify(data).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')+';\n';}
function readFeed(p){try{return JSON.parse(fs.readFileSync(p,'utf8').split('window.CINEMA_FEED = ')[1].replace(/;\s*$/,''));}catch(e){return null;}}
function get(url,token,limit){return new Promise(function(resolve,reject){
  var u=new URL(url);
  if(u.protocol!=='https:'||['api.themoviedb.org','image.tmdb.org'].indexOf(u.hostname)<0||u.username||u.password||u.port) return reject(Error('Unexpected content host'));
  var headers={'User-Agent':'PersonalHome/0.2 (private TV launcher)','Accept':token?'application/json':'image/jpeg'};
  if(token)headers.Authorization='Bearer '+token;
  var req=https.get({hostname:u.hostname,path:u.pathname+u.search,headers:headers,agent:false},function(res){
    if(res.statusCode!==200){res.resume();return reject(Error('Content provider returned HTTP '+res.statusCode));}
    if(Number(res.headers['content-length']||0)>limit){res.destroy();return reject(Error('Content response too large'));}
    var chunks=[],size=0;
    res.on('data',function(b){size+=b.length;if(size>limit){res.destroy();reject(Error('Content response too large'));return;}chunks.push(b);});
    res.on('end',function(){resolve(Buffer.concat(chunks));});res.on('error',reject);
  });
  req.setTimeout(15000,function(){req.destroy(Error('Content request timed out'));});req.on('error',reject);
});}
function destinations(){
  if(local)return [base];
  var result=[base];
  [['/var/lib/webosbrew/reza-home-v1/app','com.reza.tvhome'],['/media/developer/apps/usr/palm/applications/com.reza.tvhome','com.reza.tvhome'],['/tmp/reza-home-app','com.webos.app.home']].forEach(function(p){
    try{var a=JSON.parse(fs.readFileSync(p[0]+'/appinfo.json','utf8'));if(a.id===p[1]&&a.vendor==='Personal')result.push(p[0]+'/cinema');}catch(e){}
  });
  return result;
}
function publish(feed){
  destinations().forEach(function(d){mkdir(d);feed.items.forEach(function(a){var name=path.basename(a.image),target=path.join(d,name);if(d!==base&&!fs.existsSync(target))fs.copyFileSync(path.join(base,name),target);});atomic(path.join(d,'feed.js'),script(feed));
    fs.readdirSync(d).forEach(function(n){if(!/^tmdb-(movie|tv)-\d+-[a-f0-9]{12}\.jpg$/.test(n)||feed.items.some(function(a){return path.basename(a.image)===n;}))return;
      var p=path.join(d,n);if(Date.now()-fs.statSync(p).mtime.getTime()>24*3600000)fs.unlinkSync(p);
    });
  });
}
async function main(){
  if(!local&&fs.existsSync('/var/lib/webosbrew/reza-home-v1/disabled')){console.log('Cinema refresh skipped: Personal Home disabled.');return;}
  mkdir(base);
  var previous=readFeed(path.join(base,'feed.js'));
  if(process.argv.indexOf('--force')<0&&previous&&previous.items&&previous.items.length&&Date.now()-Date.parse(previous.updatedAt)<5.5*3600000){publish(previous);console.log('Cinema cache is current.');return;}
  var settings=JSON.parse(fs.readFileSync(settingsPath,'utf8'));
  if(typeof settings.tmdbToken!=='string'||settings.tmdbToken.length<20)throw Error('Missing content read token');
  var raw=await get('https://api.themoviedb.org/3/trending/all/day?language=en-CA',settings.tmdbToken,1024*1024),data=JSON.parse(raw.toString('utf8'));
  if(!Array.isArray(data.results))throw Error('Invalid content response');
  var candidates=data.results.filter(function(a){return a&&['movie','tv'].indexOf(a.media_type)>=0&&a.adult!==true&&Number.isSafeInteger(a.id)&&a.id>0&&typeof(a.title||a.name)==='string'&&typeof a.backdrop_path==='string'&&/^\/[A-Za-z0-9_-]+\.jpg$/.test(a.backdrop_path);}).slice(0,10);
  var items=[],next=0,total=0;
  async function worker(){while(next<candidates.length){var a=candidates[next++],url='https://image.tmdb.org/t/p/w1280'+a.backdrop_path;
    var name='tmdb-'+a.media_type+'-'+a.id+'-'+crypto.createHash('sha256').update(url).digest('hex').slice(0,12)+'.jpg',file=path.join(base,name);
    try{if(!fs.existsSync(file)){var image=await get(url,null,2*1024*1024);if(image[0]!==255||image[1]!==216||image[2]!==255)throw Error('Unexpected artwork format');total+=image.length;if(total>12*1024*1024)throw Error('Artwork budget exceeded');atomic(file,image);}
      items.push({id:a.id,type:a.media_type,title:String(a.title||a.name).slice(0,160),overview:String(a.overview||'').slice(0,700),year:String(a.release_date||a.first_air_date||'').slice(0,4),rating:typeof a.vote_average==='number'?Math.round(a.vote_average*10)/10:null,image:'cinema/'+name,rank:data.results.indexOf(a)});
    }catch(e){console.error('One artwork item unavailable; retaining the other titles.');}
  }}
  await Promise.all([worker(),worker()]);items.sort(function(a,b){return a.rank-b.rank;});
  if(!items.length)throw Error('No usable movie or show artwork; previous cache retained');
  var feed={version:1,source:'TMDB',period:'day',scope:'Worldwide trending',updatedAt:new Date().toISOString(),region:'CA',items:items};publish(feed);
  console.log(JSON.stringify({refreshed:true,items:items.length,updatedAt:feed.updatedAt}));
}
main().catch(function(){console.error('Cinema refresh failed; existing local content is unchanged.');process.exitCode=1;});
