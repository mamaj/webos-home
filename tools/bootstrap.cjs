// Create missing local config and feed files; preserve existing device snapshots.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../personal-home');
for(const name of ['config.js','cinema/feed.js','collections/feed.js','weather/feed.js']){
 const file=path.join(root,name),example=file.replace(/\.js$/,'.example.js');
 if(!fs.existsSync(file))fs.copyFileSync(example,file);
}
console.log('Local config and feed files are ready. Existing files preserved.');
