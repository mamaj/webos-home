// Measure decoded image dimensions without loading image libraries on the TV.
'use strict';
var fs=require('fs'),path=require('path'),base=process.argv[2]||'/var/lib/webosbrew/reza-cinema-v1';
function dimensions(p){var b=fs.readFileSync(p);if(b[0]===137&&b[1]===80)return {width:b.readUInt32BE(16),height:b.readUInt32BE(20)};
 if(b[0]!==255||b[1]!==216)throw Error('Unexpected JPEG');var i=2;
 while(i<b.length){while(b[i]===255)i++;var marker=b[i++];if(marker===217||marker===218)break;var size=b.readUInt16BE(i);if([192,193,194,195,197,198,199,201,202,203,205,206,207].indexOf(marker)>=0)return {width:b.readUInt16BE(i+5),height:b.readUInt16BE(i+3)};if(size<2)break;i+=size;}throw Error('Missing image dimensions');
}
var state=JSON.parse(fs.readFileSync(base+'/collections-state.json','utf8')),groups={backdrop:[],logo:[],thumb:[]},seen={},bytes=0;
Object.keys(state.enrichment).forEach(function(k){var m=state.enrichment[k];[['backdrop',m.backdrop],['logo',m.logo],['thumb',m.thumbnail]].forEach(function(pair){var kind=pair[0],v=pair[1];if(!v||seen[v])return;if(!/^collections\/assets\/(?:logo-(?:movie|tv)-\d+-[a-f0-9]{12}\.png|(?:backdrop|thumb)-(?:movie|tv)-\d+-[a-f0-9]{12}\.jpg)$/.test(v))throw Error('Unexpected asset');seen[v]=true;var p=base+'/'+v,d=dimensions(p);d.bytes=fs.statSync(p).size;bytes+=d.bytes;groups[kind].push(d);});});
var result={checkedAt:new Date().toISOString(),totalReferencedBytes:bytes};Object.keys(groups).forEach(function(k){var a=groups[k],widths=a.map(function(v){return v.width;}).sort(function(a,b){return a-b;});result[k]={count:a.length,minWidth:widths[0],medianWidth:widths[Math.floor(widths.length/2)],maxWidth:widths[widths.length-1],atLeast1920:a.filter(function(v){return v.width>=1920;}).length,above500:a.filter(function(v){return v.width>500;}).length,maxDecodedPixels:Math.max.apply(null,a.map(function(v){return v.width*v.height;}))};});console.log(JSON.stringify(result));
