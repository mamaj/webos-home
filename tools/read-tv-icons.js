// Runs on the TV: copies only explicitly selected installed-app image assets.
var fs=require('fs'),list=JSON.parse(fs.readFileSync('/tmp/reza-icon-paths.json','utf8'));
var images=list.map(function(a){
  var selected=a.paths.filter(function(p){return fs.existsSync(p);})[0];
  if(!selected)throw Error('No local icon for '+a.id);
  var data=fs.readFileSync(selected);
  if(data.length>4*1024*1024)throw Error('Unexpected icon size');
  var extension=data.slice(0,8).toString('hex')==='89504e470d0a1a0a'?'png':data.slice(0,3).toString('hex')==='ffd8ff'?'jpg':null;
  if(!extension)throw Error('Unsupported image format for '+a.id);
  return {id:a.id,source:selected,filename:a.id+'.'+extension,data:data.toString('base64')};
});
console.log(JSON.stringify(images));
