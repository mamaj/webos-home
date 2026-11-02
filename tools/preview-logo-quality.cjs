// Preview-only source selection: prefer original PNG artwork for every title.
// No recolouring, sharpening, tracing, or image reconstruction.
const fs=require('node:fs'),path=require('node:path'),https=require('node:https'),crypto=require('node:crypto');
const sharp=require('sharp');
const {readJson,privateWrite}=require('./nama-client.cjs');
const base=path.resolve(__dirname,'../.local-tv/collections-runtime'),assets=path.join(base,'collections/assets');
const hash=v=>crypto.createHash('sha256').update(v).digest('hex').slice(0,12);
async function download(route){return new Promise((resolve,reject)=>{let timer;const req=https.get({hostname:'image.tmdb.org',path:route,headers:{Accept:'image/*'},agent:false},res=>{if(res.statusCode!==200){res.resume();clearTimeout(timer);return reject(Error('Logo unavailable'));}const parts=[];let size=0;res.on('data',b=>{size+=b.length;if(size>3*1024*1024)res.destroy(Error('Logo limit'));else parts.push(b);});res.on('error',reject);res.on('end',()=>{clearTimeout(timer);resolve(Buffer.concat(parts));});});timer=setTimeout(()=>req.destroy(Error('Logo timeout')),12000);req.on('error',e=>{clearTimeout(timer);reject(e);});});}
async function colours(file){const {data,info}=await sharp(file,{limitInputPixels:6000000}).resize({width:180,height:90,fit:'inside'}).toColourspace('srgb').ensureAlpha().raw().toBuffer({resolveWithObject:true});let weight=0,red=0,green=0,blue=0,saturation=0;for(let i=0;i<data.length;i+=info.channels){const a=data[i+3]/255;if(a<.7)continue;red+=data[i]/255*a;green+=data[i+1]/255*a;blue+=data[i+2]/255*a;saturation+=(Math.max(data[i],data[i+1],data[i+2])-Math.min(data[i],data[i+1],data[i+2]))/255*a;weight+=a;}return weight?{rgb:[red/weight,green/weight,blue/weight],brightness:(.2126*red+.7152*green+.0722*blue)/weight,saturation:saturation/weight}:null;}
function visible(c){return c&&(c.brightness>.3||c.saturation>.2);}
function safePng(v){return /^collections\/assets\/logo-(movie|tv)-\d+-[a-f0-9]{12}\.png$/.test(v||'');}
async function main(){
 const state=readJson(base+'/collections-state.json');if(!state)throw Error('Missing preview data');const byId={};for(const m of Object.values(state.enrichment||{}))if(['tv','movie'].includes(m.type)&&Number.isSafeInteger(m.tmdbId))byId[m.type+':'+m.tmdbId]=m;
 const details={};for(const n of fs.readdirSync(base+'/metadata-cache')){const d=readJson(base+'/metadata-cache/'+n)?.data;if(d?.images?.logos){const key=(d.title?'movie':'tv')+':'+d.id;if(byId[key])details[key]=d;}}
 const logos={};let next=0;const jobs=Object.entries(byId);
 async function worker(){while(next<jobs.length){const [key,m]=jobs[next++];if(!safePng(m.logo))continue;let png=m.logo,current;try{current=await colours(path.join(base,png));}catch{continue;}const all=details[key]?.images?.logos||[];
  // Prefer a light/coloured supplied variant when a genuinely dark PNG is hard to read.
  if(!visible(current)){const extra=all.filter(a=>a.iso_639_1==='en'&&/^\/[A-Za-z0-9_-]+\.png$/.test(a.file_path)&&a.width>=620&&a.width<=4096&&a.height<=1200&&a.width*a.height<=1500000).sort((a,b)=>(b.vote_count||0)-(a.vote_count||0)).slice(0,6);for(const a of extra){try{const route='/t/p/original'+a.file_path,name='logo-'+m.type+'-'+m.tmdbId+'-'+hash(route)+'.png',file=path.join(assets,name);if(!fs.existsSync(file))fs.writeFileSync(file,await download(route),{mode:0o600});const c=await colours(file);if(visible(c)){png='collections/assets/'+name;current=c;break;}}catch{}}}
  logos[key]={logo:png,pngFallback:png,logoTone:'original',format:'png'};
 }}await Promise.all([worker(),worker()]);const result={updatedAt:new Date().toISOString(),logos};privateWrite(base+'/preview-logo-quality.json',result);console.log(JSON.stringify({logos:Object.keys(logos).length,vectors:0,pngs:Object.keys(logos).length}));return result;
}
module.exports={main};if(require.main===module)main().catch(()=>{console.error('Logo quality lookup unavailable; previous selection retained.');process.exitCode=1;});
