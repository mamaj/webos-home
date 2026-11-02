const fs=require('node:fs'),path=require('node:path');
const file=path.resolve(__dirname,'../.local-tv/device.json');
module.exports=function(){
 let saved={};try{saved=JSON.parse(fs.readFileSync(file,'utf8'));}catch{}
 const host=process.env.TV_HOST||saved.host;
 if(typeof host!=='string'||! /^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(host))throw Error('Set TV_HOST or .local-tv/device.json to your TV hostname/IP.');
 return {host};
};
