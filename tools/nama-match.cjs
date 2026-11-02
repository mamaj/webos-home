// Resolve the general Popular today feed to 30nama IDs; no watching history sent.
const fs=require('node:fs'),path=require('node:path');
const {NamaClient,privateWrite,privateDir}=require('./nama-client.cjs');
const root=path.resolve(__dirname,'..');
function key(title){return String(title).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(19|20)\d{2}\s*$/,'').replace(/[^a-z0-9]/g,'');}
async function main(){
 const text=fs.readFileSync(path.join(root,'personal-home/cinema/feed.js'),'utf8'),feed=JSON.parse(text.split('window.CINEMA_FEED = ')[1].replace(/;\s*$/,''));
 const client=new NamaClient(),matches={};let next=0;
 async function worker(){while(next<feed.items.length){const item=feed.items[next++];try{
  const r=await client.call('search',{query:item.title.replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim()});
  const found=(r?.posts||[]).filter(a=>a&&Number.isSafeInteger(a.id)&&key(a.title)===key(item.title)&&(!item.year||String(a.title).trim().endsWith(item.year))&&!!a.is_series===(item.type==='tv'));
  if(found.length===1)matches[item.type+':'+item.id]={id:found[0].id,title:String(found[0].title).slice(0,160),canStream:found[0].stream===true,verifiedBy:'exact-title-year-type',imdbId:/^tt\d{4,12}$/.test(found[0].imdb_id)?found[0].imdb_id:null};
 }catch{/* Ambiguous and unavailable matches stay explicit search fallbacks. */}}}
 await Promise.all([worker(),worker()]);privateWrite(path.join(privateDir,'matches.json'),matches);
 console.log(JSON.stringify({popularItems:feed.items.length,matched:Object.keys(matches).length,fallbacks:feed.items.length-Object.keys(matches).length}));
}
if(require.main===module)main().catch(()=>{console.error('Title matching unavailable. Search fallbacks remain.');process.exitCode=1;});module.exports={key};
