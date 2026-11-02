// Local-preview lookup against IMDb's public personal/non-commercial dataset.
// Downloads the same bulk file for everyone; no title or account IDs are sent.
const fs=require('node:fs'),path=require('node:path'),https=require('node:https'),zlib=require('node:zlib'),readline=require('node:readline');
const {pipeline}=require('node:stream/promises'),{Transform}=require('node:stream');
const {privateWrite,readJson}=require('./nama-client.cjs');
const base=path.resolve(__dirname,'../.local-tv/collections-runtime'),dataset=path.join(base,'imdb-title-ratings.tsv.gz');
async function download(){
 if(fs.existsSync(dataset)&&Date.now()-fs.statSync(dataset).mtimeMs<24*3600000)return;
 const response=await new Promise((resolve,reject)=>{const req=https.get('https://datasets.imdbws.com/title.ratings.tsv.gz',{headers:{Accept:'application/gzip','User-Agent':'PersonalHome private preview'}},res=>{if(res.statusCode!==200){res.resume();return reject(Error('IMDb dataset unavailable'));}resolve(res);});req.setTimeout(60000,()=>req.destroy(Error('IMDb dataset timeout')));req.on('error',reject);});
 let bytes=0;const limit=new Transform({transform(chunk,enc,done){bytes+=chunk.length;done(bytes>30*1024*1024?Error('IMDb dataset limit'):null,chunk);}});
 const temp=dataset+'.new';try{await pipeline(response,limit,fs.createWriteStream(temp,{mode:0o600}));fs.renameSync(temp,dataset);}catch(e){fs.rmSync(temp,{force:true});throw e;}
}
async function main(){
 const state=readJson(path.join(base,'collections-state.json'));if(!state)throw Error('Preview cache missing');
 const wanted=new Set(Object.values(state.enrichment||{}).map(m=>m.imdbId).concat((state.feed?.items||[]).map(i=>i.imdbId)).filter(id=>/^tt\d{4,12}$/.test(id||'')));
 await download();const source=fs.createReadStream(dataset),gunzip=zlib.createGunzip();let expanded=0;
 gunzip.on('data',b=>{expanded+=b.length;if(expanded>150*1024*1024)gunzip.destroy(Error('Expanded IMDb dataset limit'));});
 source.on('error',e=>gunzip.destroy(e));source.pipe(gunzip);
 const lines=readline.createInterface({input:gunzip,crlfDelay:Infinity}),ratings={};let header=true;
 try{for await(const line of lines){if(header){if(line!=='tconst\taverageRating\tnumVotes')throw Error('Unexpected IMDb dataset schema');header=false;continue;}if(line.length>200)throw Error('Unexpected IMDb row');const [id,score,votes]=line.split('\t');if(!wanted.has(id))continue;const rating=Number(score),count=Number(votes);if(Number.isFinite(rating)&&rating>0&&rating<=10&&Number.isSafeInteger(count)&&count>=0)ratings[id]={rating,votes:count};}}finally{lines.close();source.destroy();gunzip.destroy();}
 const result={source:'IMDb non-commercial daily dataset',updatedAt:new Date().toISOString(),ratings};privateWrite(path.join(base,'preview-imdb.json'),result);
 console.log(JSON.stringify({imdbIds:wanted.size,ratingsFound:Object.keys(ratings).length,unavailable:wanted.size-Object.keys(ratings).length}));return result;
}
module.exports={main};if(require.main===module)main().catch(()=>{console.error('IMDb ratings unavailable; the last good preview lookup is retained.');process.exitCode=1;});
