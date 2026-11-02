// Fixed outbound HTTPS reads and local snapshots. Compatible with C1 Node 8.
// Provider credentials remain outside the public app. No HTTP listener or shell API.
'use strict';
var fs=require('fs'),path=require('path'),https=require('https'),crypto=require('crypto'),URL=require('url').URL,analyseLogo=require('./logo-analysis.js').analyse;
var local=!!process.env.HOME_FEED_OUTPUT,base=local?path.resolve(process.env.HOME_FEED_OUTPUT):'/var/lib/webosbrew/reza-cinema-v1',pub=path.join(base,'collections'),assets=path.join(pub,'assets'),cache=path.join(base,'metadata-cache');
var settingsFile=process.env.HOME_FEED_SETTINGS||path.join(base,'collections-settings.json'),settings;
function mkdir(p,mode){if(fs.existsSync(p))return;mkdir(path.dirname(p),mode);fs.mkdirSync(p,mode||0o700);}
function read(p){try{return JSON.parse(fs.readFileSync(p,'utf8'));}catch(e){return null;}}
function atomic(p,b,mode){mkdir(path.dirname(p),0o700);var t=p+'.new';fs.writeFileSync(t,b,{mode:mode||0o600});fs.chmodSync(t,mode||0o600);fs.renameSync(t,p);}
function json(p,data){atomic(p,JSON.stringify(data)+'\n');}
function hash(v){return crypto.createHash('sha256').update(v).digest('hex');}
function get(host,route,headers,method,body,limit){return new Promise(function(resolve,reject){
 if(['api.themoviedb.org','image.tmdb.org','interface.30nama.com','cdn.30nama.com'].indexOf(host)<0||route.charAt(0)!=='/')return reject(Error('Unexpected provider'));
 var timer,done=false;function fail(e){if(done)return;done=true;clearTimeout(timer);reject(e);}
 var req=https.request({hostname:host,path:route,method:method||'GET',headers:headers||{},agent:false},function(res){
  if(res.statusCode!==200){res.resume();return fail(Error('Provider HTTP '+res.statusCode));}
  var parts=[],size=0;res.on('data',function(b){size+=b.length;if(size>limit){res.destroy();fail(Error('Response limit'));return;}parts.push(b);});res.on('error',fail);res.on('end',function(){if(done)return;done=true;clearTimeout(timer);resolve(Buffer.concat(parts));});
 });timer=setTimeout(function(){req.destroy(Error('Provider timeout'));},15000);req.on('error',fail);req.end(body||'');
});}
async function api(route,params,ttl){
 var query=Object.keys(params||{}).map(function(k){return encodeURIComponent(k)+'='+encodeURIComponent(params[k]);}).join('&'),url='/3/'+route+(query?'?'+query:''),p=path.join(cache,hash(url)+'.json'),old=read(p);
 if(old&&Date.now()-Date.parse(old.at)<(ttl||24*3600000))return old.data;
 var data=JSON.parse((await get('api.themoviedb.org',url,{Authorization:'Bearer '+settings.tmdbToken,Accept:'application/json'},'GET',null,2*1024*1024)).toString());json(p,{at:new Date().toISOString(),data:data});return data;
}
async function nama(route,query){
 if(!/^(stream_watched\/sortBy\/1\/sortBy\/favorite|search\/page\/1\/order\/desc\/orderby\/imdb\/)$/.test(route))throw Error('Unsupported account operation');
 var n=settings.nama;if(!n||!n.usertoken)throw Error('Reconnect 30nama');var body=query?'query='+encodeURIComponent(query):'';
 var r=JSON.parse((await get('interface.30nama.com','/api/v1/action/'+route,{'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(body),'c-api-key':n.applicationKey,'c-useragent':'PersonalHome TV connector','c-app-version':n.appVersion,'c-platform':n.platform,'c-token':n.usertoken},'POST',body,2*1024*1024)).toString());
 if(r.success!==true)throw Error(/Invalid Data|token|login|REQUESTCAPTCHA|REQUESTBLOCK/i.test(JSON.stringify(r))?'Reconnect 30nama':'30nama unavailable');return r.result;
}
async function image(type,id,remote,kind,size){
 if(!/^(movie|tv)$/.test(type)||!Number.isSafeInteger(id)||id<=0)throw Error('Invalid artwork identity');
 var ext=kind==='logo'?'png':'jpg';if(typeof remote!=='string'||!(new RegExp('^/[A-Za-z0-9_-]+\\.'+ext+'$')).test(remote))return null;
 var route='/t/p/'+(size||(kind==='logo'?'w500':kind==='thumb'?'w300':'w1280'))+remote,name=kind+'-'+type+'-'+id+'-'+hash(route).slice(0,12)+'.'+ext,p=path.join(assets,name);
 if(!fs.existsSync(p)){var b=await get('image.tmdb.org',route,{Accept:'image/*'},'GET',null,(kind==='logo'?3:6)*1024*1024);if(ext==='png'&&!b.slice(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||ext==='jpg'&&(b[0]!==255||b[1]!==216))throw Error('Unexpected artwork');atomic(p,b,0o644);}
 return 'collections/assets/'+name;
}
function number(v,min,max){var n=Number(v);return isFinite(n)&&n>=min&&n<=max?n:null;}
function normalize(a){if(!a||!Number.isSafeInteger(a.id)||a.id<=0||typeof a.title!=='string')return null;
 return {id:a.id,title:a.title.slice(0,160),type:a.is_series?'tv':'movie',imdbId:/^tt\d{4,12}$/.test(a.imdb_id||'')?a.imdb_id:null,overview:String(a.english_plot||'').slice(0,1000),year:(a.title.match(/\b(19\d{2}|20\d{2})\s*$/)||[])[1]||'',rating:number(a.imdb_score,0,10),season:number(a.season,1,200),episode:number(a.episode,1,100000),seconds:number(a.time,0,1000000),progress:number(a.progress,0,100),canStream:a.stream===true,playUrl:'https://30nama.com/play/'+a.id,image:null};
}
function rating(d,type){var all=type==='tv'?(d.content_ratings||{}).results:(d.release_dates||{}).results;all=all||[];
 for(var i=0;i<2;i++){var country=i?'US':'CA',a=all.filter(function(v){return v.iso_3166_1===country;})[0];if(!a)continue;if(type==='tv'&&a.rating)return a.rating;if(a.release_dates){var r=a.release_dates.filter(function(v){return v.certification;})[0];if(r)return r.certification;}}return null;
}
function backdropFor(d){
 var all=((d.images||{}).backdrops||[]).filter(function(a){return /^\/[A-Za-z0-9_-]+\.jpg$/.test(a.file_path||'');});
 var bounded=all.filter(function(a){return a.width>=1920&&a.width<=2560&&a.height<=1600&&Math.abs(a.aspect_ratio-16/9)<.15;});
 bounded.sort(function(a,b){return (b.file_path===d.backdrop_path)-(a.file_path===d.backdrop_path)||(b.iso_639_1===null)-(a.iso_639_1===null)||(b.vote_count||0)-(a.vote_count||0)||(b.vote_average||0)-(a.vote_average||0)||Math.abs(a.width-1920)-Math.abs(b.width-1920);});
 return bounded[0]?{path:bounded[0].file_path,size:'original',width:bounded[0].width,height:bounded[0].height}:{path:d.backdrop_path,size:'w1280',width:1280,height:null};
}
function logoCandidates(d){
 var all=((d.images||{}).logos||[]).filter(function(a){return (a.iso_639_1==='en'||a.iso_639_1===null)&&/\.png$/.test(a.file_path)&&a.width>=200;});
 all.sort(function(a,b){function suitable(v){return v.width>=620&&v.width<=4096&&v.height<=1200&&v.width*v.height<=1500000;}return (b.iso_639_1==='en')-(a.iso_639_1==='en')||suitable(b)-suitable(a)||(b.vote_count||0)-(a.vote_count||0)||(b.vote_average||0)-(a.vote_average||0);});
 return all.slice(0,3).map(function(chosen){return {path:chosen.file_path,size:chosen.width<=4096&&chosen.height<=1200&&chosen.width*chosen.height<=1500000?'original':'w500',width:chosen.width};});
}
function logoFor(d){return logoCandidates(d)[0]||null;}
async function chooseLogo(d,type,id){var options=logoCandidates(d),fallback=null;for(var i=0;i<options.length;i++){var choice=options[i],asset=null;try{asset=await image(type,id,choice.path,'logo',choice.size);}catch(e){try{asset=await image(type,id,choice.path,'logo','w500');choice.size='w500';}catch(ignore){continue;}}
 var p=path.join(cache,'logo-colour-'+hash(asset)+'.json'),colour=read(p);if(!colour)try{colour=await analyseLogo(path.join(assets,path.basename(asset)));if(colour)json(p,colour);}catch(e){}
 var result={url:asset,choice:choice,tone:colour&&colour.brightness>=.62?'light':'dark'};if(!fallback)fallback=result;if(result.tone==='light')return result;
 }return fallback;}
async function enrich(item,watching){
 var type=item.type,id=item.id;if(watching){if(!item.imdbId)return null;var f=await api('find/'+item.imdbId,{external_source:'imdb_id'}),found=f[type==='tv'?'tv_results':'movie_results']||[];if(found.length!==1)return null;id=found[0].id;}
 var d=await api(type+'/'+id,{language:'en-US',append_to_response:'images,credits,videos,external_ids,'+(type==='tv'?'content_ratings':'release_dates'),include_image_language:'en,null'});
 if(watching&&d.external_ids&&d.external_ids.imdb_id&&d.external_ids.imdb_id!==item.imdbId)return null;
 var logoResult=await chooseLogo(d,type,id),logoChoice=logoResult&&logoResult.choice,backdropChoice=backdropFor(d),logo=logoResult&&logoResult.url,backdrop=null,thumbnail=null;
 try{backdrop=await image(type,id,backdropChoice.path,'backdrop',backdropChoice.size);}catch(e){try{backdrop=await image(type,id,d.backdrop_path,'backdrop','w1280');backdropChoice={path:d.backdrop_path,size:'w1280',width:1280,height:null};}catch(ignore){}}
 try{thumbnail=await image(type,id,backdropChoice.path,'thumb','w300');}catch(e){}
 var trailers=((d.videos||{}).results||[]).filter(function(v){return v.site==='YouTube'&&/^[A-Za-z0-9_-]{11}$/.test(v.key)&&['Trailer','Teaser'].indexOf(v.type)>=0;}).sort(function(a,b){return (b.type==='Trailer')-(a.type==='Trailer')||(b.official===true)-(a.official===true);}),v=trailers[0];
 var credits=d.credits||{},m={tmdbId:id,type:type,imdbId:(d.external_ids||{}).imdb_id||null,title:d.title||d.name||item.title,overview:String(d.overview||item.overview||'').slice(0,1500),tagline:String(d.tagline||'').slice(0,200),year:String(d.release_date||d.first_air_date||item.year||'').slice(0,4),genres:(d.genres||[]).map(function(g){return g.name;}).slice(0,3),rating:typeof d.vote_average==='number'?Math.round(d.vote_average*10)/10:null,runtime:type==='movie'?d.runtime:(d.episode_run_time||[])[0]||null,certification:rating(d,type),cast:(credits.cast||[]).slice(0,4).map(function(a){return a.name;}),creators:(type==='tv'?d.created_by||[]:(credits.crew||[]).filter(function(a){return a.job==='Director';})).slice(0,2).map(function(a){return a.name;}),logo:logo,logoTone:'dark',backdrop:backdrop,trailer:v?{youtubeKey:v.key,type:v.type,title:String(v.name||'Trailer').slice(0,180),official:v.official===true}:null,episode:null};
 m.logoTone=logoResult?logoResult.tone:null;m.thumbnail=thumbnail;m.artwork={backdropSize:backdropChoice.size,backdropWidth:backdropChoice.width,backdropHeight:backdropChoice.height,thumbnailSize:'w300',logoSize:logoChoice&&logoChoice.size,logoSourceWidth:logoChoice&&logoChoice.width};
 if(watching&&type==='tv'&&Number.isInteger(item.season)&&Number.isInteger(item.episode))try{var e=await api('tv/'+id+'/season/'+item.season+'/episode/'+item.episode,{language:'en-US'});m.episode={season:item.season,number:item.episode,title:String(e.name||'').slice(0,180),runtime:e.runtime||null,overview:String(e.overview||'').slice(0,1800),airDate:e.air_date||null};}catch(e){}
 return m;
}
function itemOf(a,type){return {id:a.id,type:type||a.media_type,title:String(a.title||a.name||'').slice(0,160),overview:String(a.overview||'').slice(0,1000),year:String(a.release_date||a.first_air_date||'').slice(0,4),rating:typeof a.vote_average==='number'?a.vote_average:null,image:null,popularity:a.popularity||0};}
async function discovery(){
 var today=new Date().toISOString().slice(0,10),recent=new Date(Date.now()-365*86400000).toISOString().slice(0,10),rows=[];
 var popular=await api('trending/all/day',{language:'en-US'},6*3600000);rows.push({id:'popular',title:'Popular today',caption:'Movies & shows · Trending worldwide',items:(popular.results||[]).filter(function(a){return ['tv','movie'].indexOf(a.media_type)>=0&&!a.adult&&a.backdrop_path;}).slice(0,10).map(function(a){return itemOf(a);})});
 for(var i=0;i<3;i++){var spec=[['apple','Apple TV · New & popular',2552],['hbo','HBO · New & popular',49],['netflix','Netflix · New & popular',213]][i];
  var q={with_networks:spec[2],with_type:'2|4',without_genres:'10762,10763,10764,10767',sort_by:'popularity.desc','first_air_date.lte':today,'air_date.gte':recent,'air_date.lte':today,include_adult:false,include_null_first_air_dates:false,language:'en-US'};
  var r=await api('discover/tv',q,6*3600000),list=(r.results||[]).filter(function(a){return a.backdrop_path;});
  if(list.length<10){delete q['air_date.gte'];delete q['air_date.lte'];var more=await api('discover/tv',q,6*3600000);list=list.concat((more.results||[]).filter(function(a){return a.backdrop_path&&!list.some(function(b){return b.id===a.id;});}));}
  rows.push({id:spec[0],title:spec[1],caption:'Recent premieres & returning favourites',items:list.slice(0,10).map(function(a){return itemOf(a,'tv');})});
 }
 var a24=await api('discover/movie',{with_companies:41077,sort_by:'popularity.desc','primary_release_date.lte':today,include_adult:false,language:'en-US'},6*3600000),films=a24.results||[];
 // Verified A24 catalogue titles omitted from some production-company credits.
 // This supplements discovery, without claiming an exhaustive distributor catalogue.
 for(var j=0;j<6;j++){try{var classic=await api('movie/'+[493922,310131,1008042,376867,391713,264660][j],{language:'en-US'});if(classic.release_date&&classic.release_date<=today&&!films.some(function(a){return a.id===classic.id;}))films.push(classic);}catch(e){}}
 films=films.filter(function(a){return a.backdrop_path;}).sort(function(a,b){function score(v){var age=(Date.now()-Date.parse(v.release_date))/86400000;return (v.popularity||0)*(1+.35*Math.max(0,1-age/(3*365)));}return score(b)-score(a);});
 rows.push({id:'a24',title:'A24 · Films to discover',caption:'Popular films · Recent releases & catalogue favourites',items:films.slice(0,10).map(function(a){return itemOf(a,'movie');})});return rows;
}
function titleKey(v){return String(v).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(19|20)\d{2}\s*$/,'').replace(/[^a-z0-9]/g,'');}
async function match(item,meta,previous){
 var key=item.type+':'+item.id,p=path.join(cache,'nama-'+hash(key+item.title+item.year)+'.json'),old=read(p);if(old&&Date.now()-Date.parse(old.at)<24*3600000)return old.match;
 try{var r=await nama('search/page/1/order/desc/orderby/imdb/',item.title.replace(/[^a-zA-Z0-9\s]/g,' ').replace(/\s+/g,' ').trim()),candidates=(r.posts||[]).filter(function(a){return Number.isSafeInteger(a.id)&&!!a.is_series===(item.type==='tv');}),found=candidates.filter(function(a){return meta&&meta.imdbId&&a.imdb_id===meta.imdbId;});
  if(!found.length)found=candidates.filter(function(a){return titleKey(a.title)===titleKey(item.title)&&(!item.year||String(a.title).trim().slice(-4)===item.year);});
  var m=found.length===1?{id:found[0].id,canStream:found[0].stream===true,verifiedBy:meta&&meta.imdbId===found[0].imdb_id?'imdb':'exact-title-year-type'}:null;json(p,{at:new Date().toISOString(),match:m});return m;
 }catch(e){return previous||null;}
}
function destinations(){var out=[pub];if(local)return out;[['/var/lib/webosbrew/reza-home-v1/app','com.reza.tvhome'],['/media/developer/apps/usr/palm/applications/com.reza.tvhome','com.reza.tvhome'],['/tmp/reza-home-app','com.webos.app.home']].forEach(function(p){var a=read(p[0]+'/appinfo.json');if(a&&a.id===p[1]&&a.vendor==='Personal')out.push(p[0]+'/collections');});return out;}
function safeAsset(v){return /^collections\/assets\/(?:logo-(?:movie|tv)-\d+-[a-f0-9]{12}\.png|(?:backdrop|thumb)-(?:movie|tv)-\d+-[a-f0-9]{12}\.jpg)$/.test(v||'');}
function publish(data){var needed={};Object.keys(data.enrichment).forEach(function(k){var m=data.enrichment[k];[m.logo,m.backdrop,m.thumbnail].forEach(function(v){if(safeAsset(v))needed[path.basename(v)]=true;});});
 destinations().forEach(function(d){mkdir(d,0o755);mkdir(d+'/assets',0o755);Object.keys(needed).forEach(function(n){var target=d+'/assets/'+n;if(d!==pub&&!fs.existsSync(target)){fs.copyFileSync(assets+'/'+n,target);fs.chmodSync(target,0o644);}});atomic(d+'/feed.js','window.HOME_DATA = '+JSON.stringify(data).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')+';\n',0o644);
  fs.readdirSync(d+'/assets').forEach(function(n){if(!/^(?:logo|backdrop|thumb)-(?:movie|tv)-\d+-[a-f0-9]{12}\.(png|jpg)$/.test(n)||needed[n])return;var p=d+'/assets/'+n;if(Date.now()-fs.statSync(p).mtime.getTime()>24*3600000)fs.unlinkSync(p);});
 });json(base+'/collections-state.json',data);
}
async function main(){
 if(!local&&fs.existsSync('/var/lib/webosbrew/reza-home-v1/disabled'))return;
 mkdir(base,0o700);mkdir(pub,0o755);mkdir(assets,0o755);mkdir(cache,0o700);settings=read(settingsFile);if(!settings||typeof settings.tmdbToken!=='string')throw Error('Missing provider settings');
 var before=read(base+'/collections-state.json')||{};
 if(process.argv.indexOf('--publish-only')>=0){if(!before.rows||before.rows.length!==5)throw Error('Missing deployment snapshot');await require('./imdb-ratings.js').apply(base,before);publish(before);console.log('Saved collection snapshot published.');return before;}
 var now=new Date().toISOString(),feed=before.feed||{items:[]},status={state:'connected',lastAttemptAt:now,lastSuccessAt:(before.status||{}).lastSuccessAt||null};
 try{var history=await nama('stream_watched/sortBy/1/sortBy/favorite'),raw=Array.isArray(history)?history:history.posts;if(!Array.isArray(raw))throw Error('Unreadable watching list');feed={version:1,source:'30nama',updatedAt:now,items:raw.map(normalize).filter(Boolean).slice(0,12)};status.lastSuccessAt=now;}catch(e){status.state=/Reconnect/.test(e.message)?'reconnect':'unavailable';}
 var rows=before.rows||[],generalAt=before.generalUpdatedAt;if(process.argv.indexOf('--force')>=0||!rows.length||Date.now()-Date.parse(generalAt)>5.5*3600000)try{rows=await discovery();generalAt=now;}catch(e){if(!rows.length)throw e;}
 var result={version:2,updatedAt:now,generalUpdatedAt:generalAt,feed:feed,status:status,rows:rows,matches:{},enrichment:{}},work=feed.items.map(function(item){return {item:item,watching:true,key:'nama:'+item.id};}),seen={};
 rows.forEach(function(row){row.items.forEach(function(item){var k=item.type+':'+item.id;if(!seen[k]){seen[k]=true;work.push({item:item,watching:false,key:k});}});});
 var next=0;async function worker(){while(next<work.length){var job=work[next++],meta=null;try{meta=await enrich(job.item,job.watching);}catch(e){meta=(before.enrichment||{})[job.key]||null;}
  if(meta)result.enrichment[job.key]=meta;if(meta&&meta.backdrop)job.item.image=meta.backdrop;
  if(!job.watching){var m=status.state==='connected'?await match(job.item,meta,(before.matches||{})[job.key]):(before.matches||{})[job.key];if(m)result.matches[job.key]=m;}
 }}await Promise.all([worker(),worker()]);
 rows.forEach(function(row){row.items.forEach(function(item){var m=result.enrichment[item.type+':'+item.id];if(m&&m.backdrop)item.image=m.backdrop;});row.items=row.items.filter(function(item){return safeAsset(item.image);});});
 await require('./imdb-ratings.js').apply(base,result);publish(result);console.log(JSON.stringify({refreshed:true,rows:rows.map(function(r){return {id:r.id,items:r.items.length};}),watching:feed.items.length,accountState:status.state,metadata:Object.keys(result.enrichment).length}));return result;
}
if(require.main===module)main().catch(function(){console.error('Home feed refresh unavailable; last good cache retained.');process.exitCode=1;});
module.exports={normalize:normalize,safeAsset:safeAsset,titleKey:titleKey,backdropFor:backdropFor,logoFor:logoFor,main:main};
