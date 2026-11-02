// Export general collections for packaging; personal history stays on the TV.
'use strict';
var fs=require('fs'),path=require('path'),base=process.argv[2],out=base+'/public-seed';
if(!/^\/tmp\/reza-artwork-upgrade\/runtime$/.test(base||''))throw Error('Unexpected export source');
function mkdir(p){if(fs.existsSync(p))return;mkdir(path.dirname(p));fs.mkdirSync(p,0o755);}
var state=JSON.parse(fs.readFileSync(base+'/collections-state.json','utf8')),seed={version:state.version,updatedAt:state.updatedAt,generalUpdatedAt:state.generalUpdatedAt,feed:{items:[]},status:{state:'disconnected'},rows:state.rows,matches:state.matches,enrichment:{}};
Object.keys(state.enrichment).forEach(function(k){if(k.indexOf('nama:')!==0)seed.enrichment[k]=state.enrichment[k];});
mkdir(out+'/assets');
Object.keys(seed.enrichment).forEach(function(k){var m=seed.enrichment[k];[m.logo,m.backdrop,m.thumbnail].filter(Boolean).forEach(function(v){if(!/^collections\/assets\/(?:logo-(?:movie|tv)-\d+-[a-f0-9]{12}\.png|(?:backdrop|thumb)-(?:movie|tv)-\d+-[a-f0-9]{12}\.jpg)$/.test(v))throw Error('Unexpected asset');fs.copyFileSync(base+'/'+v,out+'/assets/'+path.basename(v));});});
fs.writeFileSync(out+'/feed.js','window.HOME_DATA = '+JSON.stringify(seed).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')+';\n');
console.log('General collection seed exported without watching history.');
