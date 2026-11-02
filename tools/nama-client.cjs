// Mac-side 30nama connector. No TV writes, SDK execution, or browser-cookie import.
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const root = path.resolve(__dirname, '..');
const privateDir = path.join(root, '.local-tv', '30nama-connector');
class NamaError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
function privateWrite(file, data) {
  fs.mkdirSync(path.dirname(file), {recursive:true, mode:0o700});
  fs.chmodSync(path.dirname(file), 0o700);
  const temp = file + '.new';
  fs.writeFileSync(temp, JSON.stringify(data, null, 2) + '\n', {mode:0o600});
  fs.chmodSync(temp, 0o600); fs.renameSync(temp, file);
}
function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } }
class NamaClient {
  constructor(options={}) {
    this.dir = options.privateDir || privateDir;
    this.provider = options.provider || readJson(path.join(this.dir, 'provider.json'));
    if (!this.provider || this.provider.apiOrigin !== 'https://interface.30nama.com') throw new NamaError('configuration', 'Missing verified provider configuration.');
    this.transport = options.transport || request;
  }
  session() { return readJson(path.join(this.dir, 'session.json')); }
  saveSession(result) {
    if (!result || typeof result.usertoken !== 'string' || result.usertoken.length < 10) throw new NamaError('invalid-session', 'The provider did not return a usable account session.');
    const previous = this.session();
    const session = {version:1, usertoken:result.usertoken, savedAt:new Date().toISOString(), connectedAt:previous?.connectedAt || new Date().toISOString()};
    if (result.userid !== undefined) session.accountId=String(result.userid);
    if (previous?.accountId && session.accountId && previous.accountId!==session.accountId) {
      for (const name of ['feed.json','history.raw.json','status.json']) fs.rmSync(path.join(this.dir,name),{force:true});
    }
    privateWrite(path.join(this.dir, 'session.json'), session);
    return session;
  }
  async call(action, args={}, {anonymous=false, tokenOverride}={}) {
    const allowed = {
      pairing:'qrcode/',
      poll:typeof args.code==='string' && /^[A-Za-z0-9_-]{1,100}$/.test(args.code) ? 'qrlogin/code/'+encodeURIComponent(args.code) : null,
      profile:'user',
      history:'stream_watched/sortBy/'+Math.max(1,Math.min(20,Number(args.page)||1))+'/sortBy/favorite',
      search:'search/page/1/order/desc/orderby/imdb/'
    };
    const route = allowed[action];
    if (!route) throw new NamaError('unsupported-action', 'Unsupported read operation.');
    const saved = this.session();
    const token = tokenOverride !== undefined ? tokenOverride : anonymous ? null : saved?.usertoken;
    if (!anonymous && !token) throw new NamaError('reconnect', 'Connect your 30nama account.');
    const response = await this.transport(this.provider, route, action==='search' ? {query:String(args.query || '').slice(0,160)} : {}, token);
    if (response.success !== true) {
      const text = JSON.stringify(response);
      const code = /REQUESTCAPTCHA|REQUESTBLOCK/i.test(text) ? 'browser-required' : /token|login|session|unauth|ورود|احراز|نشست/i.test(text) || (['profile','history'].includes(action) && /Invalid Data/i.test(text)) ? 'reconnect' : /آخرین نسخه|update|version/i.test(text) ? 'provider-update' : 'provider-error';
      throw new NamaError(code, code==='reconnect' ? '30nama requires account reconnection.' : code==='browser-required' ? '30nama requires a browser verification.' : '30nama did not accept this request.');
    }
    return response.result;
  }
  async createPairing() {
    const result = await this.call('pairing', {}, {anonymous:true});
    if (!result || !['string','number'].includes(typeof result.code) || typeof result.url!=='string') throw new NamaError('invalid-pairing', 'Unexpected device-login response.');
    const url = new URL(result.url);
    if (url.protocol!=='https:' || !['30nama.com','www.30nama.com'].includes(url.hostname)) throw new NamaError('invalid-pairing', 'Unexpected device-login destination.');
    const pending = {code:String(result.code),url:url.href,createdAt:new Date().toISOString()};
    privateWrite(path.join(this.dir,'pending.json'),pending); return pending;
  }
  async pollPairing() {
    const pending = readJson(path.join(this.dir,'pending.json'));
    if (!pending || Date.now()-Date.parse(pending.createdAt)>10*60000) throw new NamaError('expired-pairing','Start a new account connection.');
    const result = await this.call('poll',{code:pending.code},{anonymous:true});
    if (result && typeof result.usertoken==='string') {this.saveSession(result); fs.rmSync(path.join(this.dir,'pending.json'),{force:true}); return {connected:true};}
    return {connected:false};
  }
  async checkSession() {
    const before=this.session();
    const profile=await this.call('profile');
    const returned=typeof profile?.usertoken==='string';
    const rotated=returned && profile.usertoken!==before.usertoken;
    if (returned) this.saveSession(profile);
    return {authenticated:true,tokenRotated:rotated,hasRefreshToken:!!profile?.refresh_token};
  }
}
function request(provider, route, data, token) {
  return new Promise((resolve,reject)=>{
    const body = new URLSearchParams(data).toString();
    const headers = {'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(body),'c-api-key':provider.applicationKey,'c-useragent':'PersonalHome Mac connector','c-app-version':provider.appVersion,'c-platform':provider.platform};
    if (token) headers['c-token']=token;
    let timeout;
    const req=https.request({hostname:'interface.30nama.com',path:'/api/v1/action/'+route,method:'POST',headers,agent:false},res=>{
      const parts=[];let size=0;
      res.on('data',b=>{size+=b.length;if(size>2*1024*1024){res.destroy();reject(new NamaError('response-limit','Provider response exceeded its limit.'));return;}parts.push(b);});
      res.on('error',reject);
      res.on('end',()=>{
        clearTimeout(timeout);
        if (res.headers['cf-mitigated']==='challenge') return reject(new NamaError('browser-required','30nama requires a browser verification.'));
        if ([401,403].includes(res.statusCode)) return reject(new NamaError('reconnect','30nama requires account reconnection.'));
        if (res.statusCode!==200) return reject(new NamaError('network','30nama returned HTTP '+res.statusCode+'.'));
        try {const response=JSON.parse(Buffer.concat(parts).toString('utf8'));resolve(response);} catch {reject(new NamaError('invalid-response','30nama returned an unreadable response.'));}
      });
    });
    timeout=setTimeout(()=>req.destroy(new NamaError('network','30nama request timed out.')),15000);
    req.on('error',e=>{clearTimeout(timeout);reject(e instanceof NamaError?e:new NamaError('network','Could not reach 30nama.'));});
    req.end(body);
  });
}
module.exports={NamaClient,NamaError,privateWrite,readJson,privateDir,request};
if (require.main===module) {
  (async()=>{
    const client=new NamaClient(); const action=process.argv[2];
    if(action==='pair') {const result=await client.createPairing();console.log(JSON.stringify({pending:true,createdAt:result.createdAt}));}
    else if(action==='poll') console.log(JSON.stringify(await client.pollPairing()));
    else if(action==='check') console.log(JSON.stringify(await client.checkSession()));
    else throw new NamaError('usage','Use pair, poll, or check.');
  })().catch(e=>{console.error(JSON.stringify({error:e.code||'unexpected',message:e instanceof NamaError?e.message:'Connector failed.'}));process.exitCode=1;});
}
