// Calls only applicationManager/launch from our own inspected app context.
const fs=require('node:fs');
const target=JSON.parse(fs.readFileSync('.local-tv/regular-home-inspector.json','utf8'))[0];
if(!target||!target.url.includes('/com.reza.tvhome/'))throw Error('Unexpected inspector target');
const ws=new WebSocket(target.webSocketDebuggerUrl);
const timeout=setTimeout(()=>{console.error('Native launch check timed out');process.exit(1);},10000);
ws.onopen=()=>ws.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:'new Promise(function(resolve){var b=new PalmServiceBridge();window.__launchCheckBridge=b;b.onservicecallback=function(s){resolve(s);};b.call("luna://com.webos.applicationManager/launch",JSON.stringify({id:"netflix",params:{}}));})',awaitPromise:true,returnByValue:true}}));
ws.onmessage=e=>{const m=JSON.parse(String(e.data));if(m.id!==1)return;clearTimeout(timeout);console.log(JSON.stringify(m));ws.close();setTimeout(()=>process.exit(m.error?1:0),500);};
