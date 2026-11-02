// Read PNG colour information for logo selection; never alters the artwork.
// Supports the non-interlaced 8-bit RGBA/gray-alpha PNGs supplied by TMDB.
'use strict';
var fs=require('fs'),zlib=require('zlib');
function inflateBounded(data,limit){return new Promise(function(resolve,reject){var stream=zlib.createInflate(),parts=[],size=0,done=false;function fail(e){if(done)return;done=true;stream.destroy();reject(e);}stream.on('data',function(b){size+=b.length;if(size>limit)return fail(Error('PNG decode limit'));parts.push(b);});stream.on('error',fail);stream.on('end',function(){if(done)return;done=true;resolve(Buffer.concat(parts));});stream.end(data);});}
function paeth(a,b,c){var p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;}
async function analyse(file){
 var png=fs.readFileSync(file);if(png.length<33||!png.slice(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return null;
 var width=png.readUInt32BE(16),height=png.readUInt32BE(20),depth=png[24],type=png[25],channels=type===6?4:type===4?2:0;
 if(depth!==8||!channels||png[28]!==0||width>4096||height>1200||width*height>1500000||width<1||height<1)return null;
 var chunks=[],offset=8;while(offset+12<=png.length){var length=png.readUInt32BE(offset),name=png.toString('ascii',offset+4,offset+8);if(length>3*1024*1024||offset+12+length>png.length)return null;if(name==='IDAT')chunks.push(png.slice(offset+8,offset+8+length));offset+=length+12;if(name==='IEND')break;}
 var stride=width*channels,expected=(stride+1)*height,raw=await inflateBounded(Buffer.concat(chunks),expected);if(raw.length!==expected)return null;
 var previous=Buffer.alloc(stride),sum=0,weight=0,xstep=Math.max(1,Math.floor(width/180)),ystep=Math.max(1,Math.floor(height/90));
 for(var y=0;y<height;y++){var start=y*(stride+1),filter=raw[start],row=Buffer.alloc(stride);if(filter>4)return null;
  for(var x=0;x<stride;x++){var a=x>=channels?row[x-channels]:0,b=previous[x],c=x>=channels?previous[x-channels]:0,v=raw[start+1+x];row[x]=(v+(filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):paeth(a,b,c)))&255;}
  if(y%ystep===0)for(var pixel=0;pixel<width;pixel+=xstep){var at=pixel*channels,alpha=row[at+channels-1]/255;if(alpha<.75)continue;var luma=channels===2?row[at]:.2126*row[at]+.7152*row[at+1]+.0722*row[at+2];sum+=luma/255*alpha;weight+=alpha;}
  previous=row;
 }
 return weight?{brightness:sum/weight,width:width,height:height}:null;
}
module.exports={analyse:analyse};
