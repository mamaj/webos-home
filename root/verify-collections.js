// Filesystem-only deployment verification; never prints credentials or history.
'use strict';
var fs=require('fs'),crypto=require('crypto'),base='/var/lib/webosbrew/reza-cinema-v1';
function check(ok,message){if(!ok)throw Error(message);}
function read(p){return JSON.parse(fs.readFileSync(p,'utf8'));}
var expected=process.argv[2]||'0.3.2',settings=read(base+'/collections-settings.json'),state=read(base+'/collections-state.json'),roots=['/var/lib/webosbrew/reza-home-v1/app','/media/developer/apps/usr/palm/applications/com.reza.tvhome','/tmp/reza-home-app'];
check(state.rows.map(function(r){return r.id;}).join(',')==='popular,apple,hbo,netflix,a24','Unexpected collections');
check(state.rows.every(function(r){return r.items.length===10;}),'A collection is incomplete');
check(state.status.state==='connected','30nama session needs attention');
check((fs.statSync(base+'/collections-settings.json').mode&511)===384,'Private settings permissions');
var hashes={};
roots.forEach(function(root){
 var manifest=read(root+'/appinfo.json');check(manifest.vendor==='Personal'&&manifest.version===expected,'Unexpected deployed app');
 var data=fs.readFileSync(root+'/collections/feed.js','utf8');check(data.indexOf(settings.tmdbToken)<0&&data.indexOf(settings.nama.usertoken)<0,'Credential in public snapshot');
 check(!/"(?:usertoken|accountId|email|username|tmdbToken)"\s*:/.test(data),'Account identity in snapshot');
 check(fs.readFileSync(root+'/index.html','utf8').indexOf("connect-src 'none'")>=0,'Frontend network restriction changed');
 Object.keys(state.enrichment).forEach(function(k){var m=state.enrichment[k];[m.logo,m.backdrop,m.thumbnail].filter(Boolean).forEach(function(a){check(/^collections\/assets\/(?:logo-(?:movie|tv)-\d+-[a-f0-9]{12}\.png|(?:backdrop|thumb)-(?:movie|tv)-\d+-[a-f0-9]{12}\.jpg)$/.test(a),'Unexpected asset');check(fs.existsSync(root+'/'+a),'Missing deployed artwork');});});
 hashes[root]={};['app.js','collections.js','collections.css'].forEach(function(n){var data=fs.readFileSync(root+'/'+n);check(data.indexOf(settings.tmdbToken)<0&&data.indexOf(settings.nama.usertoken)<0,'Credential in source');hashes[root][n]=crypto.createHash('sha256').update(data).digest('hex');});
});
var backup=read('/var/lib/webosbrew/reza-home-v1/before-collections-v1/app/appinfo.json');check(backup.version==='0.2.3','Pre-update backup missing');
console.log(JSON.stringify({checkedAt:new Date().toISOString(),version:expected,rows:state.rows.map(function(r){return {id:r.id,items:r.items.length};}),watchingCount:state.feed.items.length,accountState:state.status.state,feedUpdatedAt:state.updatedAt,metadataCount:Object.keys(state.enrichment).length,assetCompleteness:true,credentialsOutsideApp:true,credentialMode:'600',frontendNetworkBlocked:true,previousVersion:backup.version,sourceSha256:hashes}));
