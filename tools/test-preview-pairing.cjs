const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {pairingController}=require('./preview-pairing.cjs'),{NamaClient,privateWrite}=require('./nama-client.cjs');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nama-pairing-test-'));let clock=100000,polls=0,syncs=0,approved=false;
 const client={dir,createPairing:async()=>({code:'TEST123',url:'https://30nama.com/test-login/TEST123'}),pollPairing:async()=>{polls++;return {connected:approved};}};
 try{
  const run=pairingController({client,now:()=>clock,onConnected:async()=>{syncs++;}});
  const pending=await run('start');assert.match(pending.qr,/^data:image\/svg\+xml;base64,/);assert.ok(Buffer.from(pending.qr.split(',')[1],'base64').toString().includes('<svg'));assert.equal(pending.expiresAt,clock+600000);assert.ok(!JSON.stringify(pending).includes('usertoken'));
  assert.equal((await run('poll',{pairingId:pending.pairingId})).connected,false);clock+=1000;await run('poll',{pairingId:pending.pairingId});assert.equal(polls,1);
  clock+=3000;approved=true;assert.equal((await run('poll',{pairingId:pending.pairingId})).connected,true);assert.equal(syncs,1);
  await assert.rejects(run('poll',{pairingId:pending.pairingId}),e=>e.code==='expired-pairing');
  let next=await run('start');await run('cancel',{pairingId:next.pairingId});await assert.rejects(run('poll',{pairingId:next.pairingId}));
  next=await run('start');clock+=600001;await assert.rejects(run('poll',{pairingId:next.pairingId}),e=>e.code==='expired-pairing');
  const evil=pairingController({client:{createPairing:async()=>({code:'TEST123',url:'https://evil.example/login'})}});await assert.rejects(evil('start'),e=>e.code==='invalid-pairing');
  const waitingClient=new NamaClient({privateDir:dir,provider:{apiOrigin:'https://interface.30nama.com'},transport:async()=>({success:false,msg:'null',result:null})});
  assert.equal(await waitingClient.call('poll',{code:'TEST123'},{anonymous:true}),null);
  // Cancellation during an in-flight provider response must not save its token.
  const provider={apiOrigin:'https://interface.30nama.com'};let release;
  const real=new NamaClient({privateDir:dir,provider,transport:async()=>new Promise(resolve=>{release=resolve;})});
  privateWrite(path.join(dir,'pending.json'),{code:'TEST123',createdAt:new Date().toISOString()});const inFlight=real.pollPairing();fs.unlinkSync(path.join(dir,'pending.json'));release({success:true,result:{usertoken:'test-only-session-token'}});await assert.rejects(inFlight,e=>e.code==='expired-pairing');assert.equal(real.session(),null);
  console.log('PASS QR encoding, waiting/approval, token isolation, throttling, expiry, cancellation and invalid destination.');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
