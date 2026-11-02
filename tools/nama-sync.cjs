const fs=require('node:fs'),path=require('node:path'),https=require('node:https'),crypto=require('node:crypto');
const {NamaClient,NamaError,privateWrite,readJson,privateDir}=require('./nama-client.cjs');
function number(value,min,max) {const n=Number(value);return Number.isFinite(n)&&n>=min&&n<=max?n:null;}
function normalize(a) {
  if(!a||!Number.isSafeInteger(a.id)||a.id<=0||typeof a.title!=='string')return null;
  const image=a.image?.cover;
  let imageUrl=null;
  try {const u=new URL(image);if(u.protocol==='https:'&&u.hostname==='cdn.30nama.com'&&!u.port&&!u.username&&!u.password&&/^\/cover\/[a-zA-Z0-9_.-]+\.jpg$/.test(u.pathname))imageUrl=u.href;} catch{}
  return {id:a.id,title:a.title.slice(0,160),type:a.is_series?'tv':'movie',imdbId:/^tt\d{4,12}$/.test(a.imdb_id)?a.imdb_id:null,
    overview:String(a.english_plot||a.persian_plot||'').slice(0,700),year:(a.title.match(/\b(19\d{2}|20\d{2})\s*$/)||[])[1]||'',rating:number(a.imdb_score,0,10),
    season:number(a.season,1,200),episode:number(a.episode,1,100000),seconds:number(a.time,0,1000000),progress:number(a.progress,0,100),
    canStream:a.stream===true,pageUrl:'https://30nama.com/'+(a.is_series?'series':'movie')+'/'+a.id,
    playUrl:'https://30nama.com/play/'+a.id,imageUrl,image:null};
}
function imageGet(url){return new Promise((resolve,reject)=>{
  const u=new URL(url);if(u.protocol!=='https:'||u.hostname!=='cdn.30nama.com'||u.port||u.username||u.password)return reject(new Error('Unexpected image host'));
  let timer;const req=https.get({hostname:u.hostname,path:u.pathname+u.search,agent:false,headers:{Accept:'image/jpeg'}},res=>{
    if(res.statusCode!==200){res.resume();clearTimeout(timer);return reject(new Error('Artwork unavailable'));}
    const parts=[];let size=0;res.on('data',b=>{size+=b.length;if(size>3*1024*1024){res.destroy();reject(new Error('Artwork limit'));return;}parts.push(b);});res.on('error',reject);
    res.on('end',()=>{clearTimeout(timer);const b=Buffer.concat(parts);if(b[0]!==255||b[1]!==216)return reject(new Error('Unexpected artwork'));resolve(b);});
  });timer=setTimeout(()=>req.destroy(new Error('Artwork timeout')),12000);req.on('error',e=>{clearTimeout(timer);reject(e);});
});}
async function sync(options={}){
 const dir=options.privateDir||privateDir,client=options.client||new NamaClient({privateDir:dir});
 try{
  const state=await client.checkSession();
  const data=await client.call('history',{page:1});
  const raw=Array.isArray(data)?data:data?.posts;
  if(!Array.isArray(raw))throw new NamaError('invalid-response','The watching list was unreadable.');
  const items=raw.map(normalize).filter(Boolean).slice(0,12),imageDir=path.join(dir,'images');fs.mkdirSync(imageDir,{recursive:true,mode:0o700});
  let next=0;
  async function worker(){while(next<items.length){const item=items[next++];if(!item.imageUrl)continue;const name='30nama-'+item.id+'-'+crypto.createHash('sha256').update(item.imageUrl).digest('hex').slice(0,12)+'.jpg',file=path.join(imageDir,name);
    try{if(!fs.existsSync(file)){const bytes=await imageGet(item.imageUrl);fs.writeFileSync(file,bytes,{mode:0o600});fs.chmodSync(file,0o600);}item.image='nama/images/'+name;}catch{/* Missing artwork never blocks the list. */}
  }}
  if(!options.skipImages)await Promise.all([worker(),worker()]);
  items.forEach(a=>delete a.imageUrl);
  const feed={version:1,source:'30nama',updatedAt:new Date().toISOString(),totalOnPage:raw.length,items};
  privateWrite(path.join(dir,'feed.json'),feed);
  privateWrite(path.join(dir,'status.json'),{state:'connected',lastAttemptAt:new Date().toISOString(),lastSuccessAt:feed.updatedAt,tokenRotated:state.tokenRotated,automaticRefreshAvailable:false});
  return {connected:true,items:items.length,totalOnPage:raw.length,artwork:items.filter(a=>a.image).length,updatedAt:feed.updatedAt};
 }catch(e){
  const previous=readJson(path.join(dir,'status.json'));
  privateWrite(path.join(dir,'status.json'),{state:e.code==='reconnect'?'reconnect':e.code==='browser-required'?'browser-required':'unavailable',lastAttemptAt:new Date().toISOString(),lastSuccessAt:previous?.lastSuccessAt||null,errorCode:e.code||'unexpected'});
  throw e;
 }
}
module.exports={sync,normalize,imageGet};
if(require.main===module)sync().then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(JSON.stringify({error:e.code||'unexpected',message:e instanceof NamaError?e.message:'Could not refresh the watching list.'}));process.exitCode=1;});
