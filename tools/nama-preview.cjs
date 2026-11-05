// Loopback-only preview of the same launcher source deployed on the TV.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {readJson,privateWrite,privateDir,NamaClient,NamaError}=require('./nama-client.cjs');
const root=path.resolve(__dirname,'..'),app=path.join(privateDir,'preview','app');
const savedWeather=fs.existsSync(path.join(app,'weather/feed.js'))?fs.readFileSync(path.join(app,'weather/feed.js')):null;
fs.mkdirSync(app,{recursive:true,mode:0o700});fs.cpSync(path.join(root,'personal-home'),app,{recursive:true});
if(savedWeather)fs.writeFileSync(path.join(app,'weather/feed.js'),savedWeather);
// Proposed appearance is preview-only until explicitly approved for the TV.
for(const [from,to] of [['refined-collections.js','collections.js'],['refined-collections.css','collections.css']]){
 const draft=path.join(root,'preview',from);if(fs.existsSync(draft))fs.copyFileSync(draft,path.join(app,to));
}
fs.mkdirSync(path.join(app,'fonts'),{recursive:true});
const fontFiles=['manrope.ttf','Manrope-OFL.txt','outfit.ttf','Outfit-OFL.txt','geist.ttf','Geist-OFL.txt','sora.ttf','Sora-OFL.txt'];
for(const name of fontFiles)fs.copyFileSync(path.join(root,'preview/fonts',name),path.join(app,'fonts',name));
const previewHtml=fs.readFileSync(path.join(app,'index.html'),'utf8').replace("connect-src 'none'", "connect-src 'self'");
fs.writeFileSync(path.join(app,'index.html'),previewHtml);
// Keep the preview's initial ordering consistent with the last accepted TV layout.
let config=fs.readFileSync(path.join(app,'config.js'),'utf8');config+='\nwindow.HOME_CONFIG.preview=true;window.HOME_CONFIG.previewConnection=true;\nwindow.HOME_CONFIG.favorites=["youtube.leanback.v4","com.webos.app.browser","netflix","amazon","com.apple.appletv","com.disney.disneyplus-prod"];\n';fs.writeFileSync(path.join(app,'config.js'),config);
const permitted=new Set(['index.html','app.js','config.js','style.css','icon.png','largeIcon.png','tmdb-logo.svg','cinema/feed.js','weather/feed.js','collections.js','collections.css','collections/feed.js']);
fontFiles.forEach(name=>permitted.add('fonts/'+name));
for(const dir of ['icons','cinema'])for(const file of fs.readdirSync(path.join(app,dir)))if(/^[a-z0-9._-]+\.(png|jpg)$/.test(file))permitted.add(dir+'/'+file);
const previous=process.argv.includes('--reuse-url')?readJson(path.join(privateDir,'preview-server.json')):null;
const oldPrefix=previous&&new URL(previous.url).pathname;
const prefix=/^\/preview\/[a-f0-9]{36}\/$/.test(oldPrefix||'')?oldPrefix:'/preview/'+crypto.randomBytes(18).toString('hex')+'/';
const types={'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.html':'text/html; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8'};
const fontVariants={outfit:{name:'Outfit',max:900},geist:{name:'Geist Sans',max:900},sora:{name:'Sora',max:800}};
let expectedOrigin,refreshing=false,refreshPromise=null;
function refreshData(){
 const task=(refreshPromise||Promise.resolve()).catch(()=>{}).then(async()=>{process.env.HOME_FEED_OUTPUT=path.join(root,'.local-tv/collections-runtime');await require('../root/home-feed-refresh.js').main();await require('./preview-imdb.cjs').main();await require('./preview-logo-quality.cjs').main();});
 refreshPromise=task;task.finally(()=>{if(refreshPromise===task)refreshPromise=null;}).catch(()=>{});return task;
}
const pairing=require('./preview-pairing.cjs').pairingController({onConnected:async()=>{
 if(refreshPromise)try{await refreshPromise;}catch{}
 const client=new NamaClient(),session=client.session(),settingsPath=path.join(root,'.local-tv/collections-runtime/collections-settings.json'),settings=readJson(settingsPath);
 if(!settings)throw Error('Missing preview metadata configuration');
 settings.nama={...client.provider,usertoken:session.usertoken};privateWrite(settingsPath,settings);
 // Clear the preceding account's personal row before publishing another account.
 const statePath=path.join(root,'.local-tv/collections-runtime/collections-state.json'),state=readJson(statePath)||{};
 state.feed={items:[]};state.status={state:'syncing'};state.updatedAt=new Date().toISOString();
 state.enrichment=Object.fromEntries(Object.entries(state.enrichment||{}).filter(([key])=>!key.startsWith('nama:')));privateWrite(statePath,state);
 refreshData().catch(()=>{const latest=readJson(statePath)||state;latest.status={state:'unavailable'};latest.updatedAt=new Date().toISOString();privateWrite(statePath,latest);console.log('Signed in; preview refresh unavailable, retry scheduled.');});return {startedAt:state.updatedAt};
}});

const server=http.createServer((req,res)=>{
 if(!['GET','POST'].includes(req.method)||req.headers.host!==new URL(expectedOrigin).host||(req.headers.origin&&req.headers.origin!==expectedOrigin)){res.writeHead(403);return res.end();}
 const url=new URL(req.url,expectedOrigin);
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cross-Origin-Resource-Policy','same-origin');res.setHeader('Referrer-Policy','no-referrer');
 if(!url.pathname.startsWith(prefix)){res.writeHead(404);return res.end();}
 const name=url.pathname.slice(prefix.length)||'index.html';
 if(/^connection\/(start|poll|cancel)$/.test(name)){
  if(req.method!=='POST'||req.headers.origin!==expectedOrigin||req.headers['x-personal-home']!=='1'||!/^application\/json(?:;|$)/.test(req.headers['content-type']||'')||Number(req.headers['content-length'])>1024){res.writeHead(403);return res.end();}
  let body='',tooLarge=false;
  req.on('data',b=>{body+=b.toString();if(body.length>1024){tooLarge=true;req.destroy();}});
  req.on('end',async()=>{
   if(tooLarge)return;
   res.setHeader('Content-Type','application/json');
   let args;try{args=JSON.parse(body||'{}');if(!args||typeof args!=='object'||Array.isArray(args))throw Error();}catch{res.writeHead(400);return res.end(JSON.stringify({message:'Invalid request.'}));}
   try{res.end(JSON.stringify(await pairing(name.split('/')[1],args)));}catch(e){res.writeHead(400);res.end(JSON.stringify({error:e.code||'unavailable',message:e instanceof NamaError?e.message:'Could not complete the connection. Try again.'}));}
  });return;
 }
 if(req.method!=='GET'){res.writeHead(405);return res.end();}
 const font=Object.hasOwn(fontVariants,url.searchParams.get('font'))?url.searchParams.get('font'):null;
 if(name==='index.html'&&font){
  const html=fs.readFileSync(path.join(app,'index.html'),'utf8').replace('</head>','<link rel="stylesheet" href="font-variant.css?font='+font+'"></head>').replace('</body>','<script src="font-variant.js?font='+font+'"></script></body>');
  res.setHeader('Content-Type',types['.html']);return res.end(html);
 }
 if(name==='font-variant.css'&&font){
  const variant=fontVariants[font];res.setHeader('Content-Type',types['.css']);
  return res.end('@font-face{font-family:"Home '+variant.name+'";src:url("fonts/'+font+'.ttf") format("truetype");font-style:normal;font-weight:100 '+variant.max+';font-display:swap;}body,button{font-family:"Home '+variant.name+'","LG Smart UI","Segoe UI",Arial,sans-serif;}.home-page .tile .caption{left:-6px;right:-6px;}');
 }
 if(name==='font-variant.js'&&font){
  const variant=fontVariants[font];res.setHeader('Content-Type',types['.js']);return res.end('document.title='+JSON.stringify('Personal Home — '+variant.name)+';var badge=document.querySelector(".preview-badge");if(badge)badge.textContent='+JSON.stringify('MAC PREVIEW · '+variant.name.toUpperCase())+';');
 }
 let file;
 if(name==='collections/feed.js'){
  const state=readJson(path.join(root,'.local-tv/collections-runtime/collections-state.json'))||{};
  const imdb=readJson(path.join(root,'.local-tv/collections-runtime/preview-imdb.json'))||{};
  const quality=readJson(path.join(root,'.local-tv/collections-runtime/preview-logo-quality.json'))||{};
  const enrichment=Object.fromEntries(Object.entries(state.enrichment||{}).map(([key,m])=>[key,{...m,...((quality.logos||{})[m.type+':'+m.tmdbId]||{})}]));
  const data={...state,enrichment,imdbRatings:imdb.ratings||{},imdbUpdatedAt:imdb.updatedAt||null};
  res.setHeader('Content-Type',types['.js']);return res.end('window.HOME_DATA = '+JSON.stringify(data).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')+';\n');
 }
 else if(/^collections\/assets\/(?:logo-(?:movie|tv)-\d+-[a-f0-9]{12}\.png|(?:backdrop|thumb)-(?:movie|tv)-\d+-[a-f0-9]{12}\.jpg)$/.test(name))file=path.join(root,'.local-tv/collections-runtime/collections/assets',path.basename(name));
 else if(/^collections\/assets\/logo-(?:movie|tv)-\d+-[a-f0-9]{12}\.svg$/.test(name)&&Object.values((readJson(path.join(root,'.local-tv/collections-runtime/preview-logo-quality.json'))||{}).logos||{}).some(v=>v.logo===name)){file=path.join(root,'.local-tv/collections-runtime/collections/assets',path.basename(name));res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; sandbox");}
 else if(permitted.has(name))file=path.join(app,name);
 else{res.writeHead(404);return res.end();}
 fs.readFile(file,(err,bytes)=>{if(err){res.writeHead(404);return res.end();}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(bytes);});
});
server.listen(previous?.port||0,'127.0.0.1',()=>{
 const port=server.address().port;expectedOrigin='http://127.0.0.1:'+port;
 const info={url:expectedOrigin+prefix,port,pid:process.pid,startedAt:new Date().toISOString()};privateWrite(path.join(privateDir,'preview-server.json'),info);console.log(JSON.stringify({previewUrl:info.url,bind:'127.0.0.1',tvChanged:false}));
});
const timer=setInterval(async()=>{
 if(refreshing)return;refreshing=true;
 try{await refreshData();}catch{console.log('Preview refresh unavailable; last good snapshot retained.');}finally{refreshing=false;}
},15*60000);
function stop(){clearInterval(timer);server.close(()=>process.exit(0));}process.on('SIGTERM',stop);process.on('SIGINT',stop);
