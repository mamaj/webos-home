// Stream the official public daily dataset; no account or title identifiers sent.
'use strict';
var fs=require('fs'),https=require('https'),zlib=require('zlib'),readline=require('readline'),path=require('path');
function read(p){try{return JSON.parse(fs.readFileSync(p,'utf8'));}catch(e){return null;}}
exports.apply=async function(base,data){
 var file=path.join(base,'imdb-ratings.json'),old=read(file),wanted={};
 Object.keys(data.enrichment||{}).forEach(function(k){var id=data.enrichment[k].imdbId;if(/^tt\d{4,12}$/.test(id||''))wanted[id]=true;});
 if(!old||Date.now()-Date.parse(old.updatedAt)>24*3600000){try{
  var ratings=await new Promise(function(resolve,reject){
   var done=false,timer,bytes=0,expanded=0,ratings={},header=true,req,gunzip,lines;
   function end(err){if(done)return;done=true;clearTimeout(timer);if(lines)lines.close();if(gunzip)gunzip.destroy();if(req)req.destroy();err?reject(err):resolve(ratings);}
   req=https.get({hostname:'datasets.imdbws.com',path:'/title.ratings.tsv.gz',headers:{'User-Agent':'PersonalHome private non-commercial'},agent:false},function(res){
    if(res.statusCode!==200){res.resume();return end(Error('IMDb unavailable'));}
    res.on('error',end);res.on('data',function(b){bytes+=b.length;if(bytes>30*1024*1024)end(Error('Dataset size'));});
    gunzip=zlib.createGunzip();gunzip.on('error',end);gunzip.on('data',function(b){expanded+=b.length;if(expanded>150*1024*1024)end(Error('Expanded size'));});
    lines=readline.createInterface({input:gunzip,crlfDelay:Infinity});lines.on('error',end);lines.on('line',function(line){
     if(done)return;if(header){header=false;if(line!=='tconst\taverageRating\tnumVotes')end(Error('Dataset schema'));return;}
     if(line.length>200)return end(Error('Dataset row'));var a=line.split('\t');if(!wanted[a[0]])return;var score=Number(a[1]),votes=Number(a[2]);if(score>0&&score<=10&&Number.isSafeInteger(votes)&&votes>=0)ratings[a[0]]={rating:score,votes:votes};
    });lines.on('close',function(){if(!done)end();});res.pipe(gunzip);
   });req.on('error',end);timer=setTimeout(function(){end(Error('IMDb timeout'));},60000);
  });
  old={source:'IMDb non-commercial daily dataset',updatedAt:new Date().toISOString(),ratings:ratings};fs.writeFileSync(file+'.new',JSON.stringify(old),{mode:0o600});fs.renameSync(file+'.new',file);
 }catch(e){/* Keep the last good ratings; never substitute TMDB. */}}
 data.imdbRatings=old&&old.ratings||{};data.imdbUpdatedAt=old&&old.updatedAt||null;
 var quality=read(path.join(base,'logo-quality.json'))||{};
 Object.keys(data.enrichment||{}).forEach(function(k){var m=data.enrichment[k],q=(quality.logos||{})[m.type+':'+m.tmdbId];if(q&&/^collections\/assets\/logo-(movie|tv)-\d+-[a-f0-9]{12}\.png$/.test(q.logo)&&fs.existsSync(path.join(base,q.logo)))m.logo=q.logo;m.logoTone='original';});
};
