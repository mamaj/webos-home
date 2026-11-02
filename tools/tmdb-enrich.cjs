// Enrich the local preview only. Sends IMDb/TMDB IDs, never account credentials,
// playback timestamps, progress percentages, profile IDs, or 30nama credentials.
const fs=require('node:fs'),path=require('node:path'),https=require('node:https'),crypto=require('node:crypto');
const sharp=require('sharp');
const {privateDir,readJson,privateWrite}=require('./nama-client.cjs');
const root=path.resolve(__dirname,'..'),base=path.join(privateDir,'enriched'),assets=path.join(base,'assets'),cache=path.join(base,'cache');
for(const p of [base,assets,cache]){fs.mkdirSync(p,{recursive:true,mode:0o700});fs.chmodSync(p,0o700);}
const token=readJson(path.join(root,'.local-tv/cinema-settings.json'))?.tmdbToken;
if(typeof token!=='string')throw Error('Missing private TMDB read configuration.');
function get(host,url,limit,authenticated=false){return new Promise((resolve,reject)=>{
 if(!['api.themoviedb.org','image.tmdb.org'].includes(host)||authenticated&&host!=='api.themoviedb.org')return reject(Error('Unexpected provider'));
 let timer;const headers={Accept:authenticated?'application/json':'image/*','User-Agent':'PersonalHome Mac Preview/0.3'};if(authenticated)headers.Authorization='Bearer '+token;
 const req=https.get({hostname:host,path:url,headers,agent:false},res=>{
  if(res.statusCode!==200){res.resume();clearTimeout(timer);return reject(Error('Provider HTTP '+res.statusCode));}
  let size=0;const parts=[];res.on('data',b=>{size+=b.length;if(size>limit){res.destroy();reject(Error('Response limit'));return;}parts.push(b);});res.on('error',reject);res.on('end',()=>{clearTimeout(timer);resolve(Buffer.concat(parts));});
 });timer=setTimeout(()=>req.destroy(Error('Request timeout')),15000);req.on('error',e=>{clearTimeout(timer);reject(e);});
});}
async function api(route,params={}){
 const query=new URLSearchParams(params),url='/3/'+route+(query.size?'?'+query.toString():''),name=crypto.createHash('sha256').update(url).digest('hex')+'.json',file=path.join(cache,name),old=readJson(file);
 if(old&&Date.now()-Date.parse(old.cachedAt)<24*3600000)return old.data;
 const data=JSON.parse((await get('api.themoviedb.org',url,2*1024*1024,true)).toString());privateWrite(file,{cachedAt:new Date().toISOString(),data});return data;
}
async function artwork(type,id,filePath,kind,size='w1280'){
 const ext=kind==='logo'?'png':'jpg';if(typeof filePath!=='string'||!new RegExp('^/[A-Za-z0-9_-]+\\.'+ext+'$').test(filePath))return null;
 const remote='/t/p/'+size+filePath,name=kind+'-'+type+'-'+id+'-'+crypto.createHash('sha256').update(remote).digest('hex').slice(0,12)+'.'+ext,file=path.join(assets,name);
 if(!fs.existsSync(file)){const b=await get('image.tmdb.org',remote,3*1024*1024);if(ext==='png'&&!b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||ext==='jpg'&&(b[0]!==255||b[1]!==216))throw Error('Unexpected image format');fs.writeFileSync(file,b,{mode:0o600});fs.chmodSync(file,0o600);}
 return {url:'enriched/assets/'+name,file};
}
async function logoFor(type,id,logos){
 const candidates=(logos||[]).filter(a=>a.file_path?.endsWith('.png')&&[null,'en'].includes(a.iso_639_1)&&a.width>=200).sort((a,b)=>(b.iso_639_1==='en')-(a.iso_639_1==='en')||(b.vote_count||0)-(a.vote_count||0)).slice(0,3);
 let best=null;
 for(const a of candidates){try{const asset=await artwork(type,id,a.file_path,'logo','w500');if(!asset)continue;
  const {data,info}=await sharp(asset.file).resize({width:160,height:80,fit:'inside',withoutEnlargement:true}).ensureAlpha().raw().toBuffer({resolveWithObject:true});let sum=0,weight=0;
  for(let i=0;i<data.length;i+=info.channels){const alpha=data[i+3]/255;if(alpha<.2)continue;sum+=(.2126*data[i]+.7152*data[i+1]+.0722*data[i+2])*alpha;weight+=alpha;}
  const brightness=weight?sum/weight/255:0,score=brightness+(a.iso_639_1==='en'?.15:0);
  if(!best||score>best.score)best={url:asset.url,tone:brightness<.43?'dark':'light',score};
 }catch{/* Fall back to the title when no logo can be read. */}}
 return best;
}
function trailerOf(videos){return (videos||[]).filter(v=>v.site==='YouTube'&&/^[A-Za-z0-9_-]{11}$/.test(v.key)&&['Trailer','Teaser'].includes(v.type)).sort((a,b)=>(b.type==='Trailer')-(a.type==='Trailer')||(b.official===true)-(a.official===true))[0]||null;}
function certification(data,type){
 if(type==='tv'){const all=data.content_ratings?.results||[];return ['CA','US'].map(c=>all.find(a=>a.iso_3166_1===c)?.rating).find(Boolean)||null;}
 const all=data.release_dates?.results||[];return ['CA','US'].map(c=>all.find(a=>a.iso_3166_1===c)?.release_dates?.find(a=>a.certification)?.certification).find(Boolean)||null;
}
async function enrich(item,watching){
 const type=item.type;let id=item.id;
 if(watching){if(!/^tt\d{4,12}$/.test(item.imdbId||''))return null;const found=await api('find/'+item.imdbId,{external_source:'imdb_id'}),results=found[type==='tv'?'tv_results':'movie_results']||[];if(results.length!==1)return null;id=results[0].id;}
 const append=type==='tv'?'images,credits,videos,external_ids,content_ratings':'images,credits,videos,external_ids,release_dates';
 const d=await api(type+'/'+id,{language:'en-US',append_to_response:append,include_image_language:'en,null'});
 if(watching&&d.external_ids?.imdb_id&&d.external_ids.imdb_id!==item.imdbId)return null;
 const video=trailerOf(d.videos?.results),logo=await logoFor(type,id,d.images?.logos);
 let backdrop=null;try{backdrop=await artwork(type,id,d.backdrop_path,'backdrop');}catch{}
 const meta={tmdbId:id,type,title:d.title||d.name||item.title,overview:String(d.overview||item.overview||'').slice(0,1500),tagline:String(d.tagline||'').slice(0,200),year:String(d.release_date||d.first_air_date||item.year||'').slice(0,4),genres:(d.genres||[]).map(a=>a.name).slice(0,3),rating:typeof d.vote_average==='number'?Math.round(d.vote_average*10)/10:null,runtime:type==='movie'?d.runtime:d.episode_run_time?.[0]||null,certification:certification(d,type),status:d.status||null,cast:(d.credits?.cast||[]).slice(0,4).map(a=>a.name),creators:type==='tv'?(d.created_by||[]).slice(0,2).map(a=>a.name):(d.credits?.crew||[]).filter(a=>a.job==='Director').slice(0,2).map(a=>a.name),logo:logo?.url||null,logoTone:logo?.tone||null,backdrop:backdrop?.url||null,trailer:video?{youtubeKey:video.key,type:video.type,title:String(video.name||'Official trailer').slice(0,180),official:video.official===true}:null,episode:null};
 if(watching&&type==='tv'&&Number.isInteger(item.season)&&Number.isInteger(item.episode))try{
  const e=await api('tv/'+id+'/season/'+item.season+'/episode/'+item.episode,{language:'en-US'});
  meta.episode={season:item.season,number:item.episode,title:String(e.name||'').slice(0,180),airDate:e.air_date||null,runtime:e.runtime||null,overview:String(e.overview||'').slice(0,1800)};
 }catch{/* Missing episode metadata retains the 30nama progress. */}
 return meta;
}
async function main(){
 const watching=readJson(path.join(privateDir,'feed.json'))?.items||[];
 const cinema=JSON.parse(fs.readFileSync(path.join(root,'personal-home/cinema/feed.js'),'utf8').split('window.CINEMA_FEED = ')[1].replace(/;\s*$/,''));
 const work=watching.map(item=>({item,watching:true,key:'nama:'+item.id})).concat(cinema.items.map(item=>({item,watching:false,key:item.type+':'+item.id})));
 const previous=readJson(path.join(base,'feed.json'))?.items||{},result={};let next=0,failed=0;
 async function worker(){while(next<work.length){const job=work[next++];try{const meta=await enrich(job.item,job.watching);if(meta)result[job.key]=meta;else failed++;}catch{failed++;if(previous[job.key])result[job.key]=previous[job.key];}}}
 await Promise.all([worker(),worker()]);
 const feed={version:1,updatedAt:new Date().toISOString(),items:result};privateWrite(path.join(base,'feed.json'),feed);
 const values=Object.values(result);console.log(JSON.stringify({items:values.length,watchingMatched:watching.filter(i=>result['nama:'+i.id]).length,logos:values.filter(a=>a.logo).length,trailers:values.filter(a=>a.trailer).length,episodes:values.filter(a=>a.episode).length,fallbacks:failed}));
}
if(require.main===module)main().catch(()=>{console.error('Metadata enrichment unavailable; existing preview assets retained.');process.exitCode=1;});
module.exports={trailerOf,certification,enrichPreview:main};
