// Loopback preview device login. No account credential is returned to the page.
const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),QRCode=require('qrcode');
const {NamaClient,NamaError,privateDir}=require('./nama-client.cjs');
function pairingController({client=new NamaClient(),onConnected=async()=>{},now=Date.now}={}){
 let active=null,starting=null,polling=null,lastPoll=0;
 function current(id){if(!active||id!==active.pairingId)throw new NamaError('expired-pairing','Start a new connection.');if(now()>=active.expiresAt){active=null;throw new NamaError('expired-pairing','This code expired. Generate a new code.');}return active;}
 return async function(action,args={}){
  if(action==='start'){
   if(starting)return starting;
   starting=(async()=>{
    const pending=await client.createPairing();
    const url=new URL(pending.url);
    if(url.protocol!=='https:'||!['30nama.com','www.30nama.com'].includes(url.hostname)||url.username||url.password||url.port||url.href.length>2048)throw new NamaError('invalid-pairing','Unexpected sign-in link.');
    if(!/^[A-Za-z0-9_-]{1,100}$/.test(pending.code))throw new NamaError('invalid-pairing','Unexpected sign-in code.');
    const svg=await QRCode.toString(url.href,{type:'svg',errorCorrectionLevel:'M',margin:4,width:320});
    active={pairingId:crypto.randomBytes(16).toString('hex'),code:pending.code,url:url.href,expiresAt:now()+10*60000,qr:'data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64')};lastPoll=0;
    return active;
   })();try{return await starting;}finally{starting=null;}
  }
  if(action==='cancel'){
   if(active&&args.pairingId===active.pairingId){active=null;fs.rmSync(path.join(client.dir||privateDir,'pending.json'),{force:true});}
   return {cancelled:true};
  }
  if(action!=='poll')throw new NamaError('unsupported-action','Unknown sign-in action.');
  const pending=current(args.pairingId);
  if(polling)return {connected:false,waiting:true};
  if(now()-lastPoll<3000)return {connected:false,waiting:true};
  lastPoll=now();
  polling=client.pollPairing();
  try{
   const result=await polling;
   if(active!==pending)return {cancelled:true};
   if(result.connected){active=null;const sync=await onConnected();return {connected:true,refreshAfter:sync&&sync.startedAt};}
   return {connected:false,waiting:true};
  }finally{polling=null;}
 };
}
module.exports={pairingController};
