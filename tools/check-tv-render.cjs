// Read the installed app's own webOS inspector target; save no credentials.
const fs = require('node:fs');
const path = require('node:path');
const url = new URL(process.argv[2]);
if (url.protocol !== 'ws:' || !['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.startsWith('/devtools/page/')) throw Error('Use the local app inspector URL returned by ares-inspect.');
const socket = new WebSocket(url.href);
let sequence = 0;
const pending = new Map();
const exceptions = [];
function call(method, params) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => { pending.delete(id); reject(Error(method + ' timed out')); }, 10000);
    pending.set(id, {resolve, reject, timeout});
    socket.send(JSON.stringify({id, method, params:params || {}}));
  });
}
socket.addEventListener('message', event => {
  const message = JSON.parse(String(event.data));
  if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text);
  const item = pending.get(message.id);
  if (!item) return;
  pending.delete(message.id); clearTimeout(item.timeout);
  if (message.error) item.reject(Error(JSON.stringify(message.error))); else item.resolve(message.result);
});
socket.addEventListener('error', () => { console.error('TV inspector connection failed.'); process.exitCode = 1; });
socket.addEventListener('open', async () => {
  try {
    await call('Runtime.enable'); await call('Page.enable');
    const result = await call('Runtime.evaluate', {expression:`JSON.stringify({url:location.href,readyState:document.readyState,userAgent:navigator.userAgent,bridge:typeof PalmServiceBridge,heading:document.getElementById('heading')&&document.getElementById('heading').textContent,tiles:document.querySelectorAll('#grid button').length,viewport:[innerWidth,innerHeight],focus:document.activeElement&&document.activeElement.getAttribute('data-app'),resources:performance.getEntriesByType('resource').map(function(r){return r.name;}),csp:document.querySelector('meta[http-equiv="Content-Security-Policy"]').content})`,returnByValue:true});
    if (result.exceptionDetails) throw Error(result.exceptionDetails.text);
    const state = JSON.parse(result.result.value);
    if (!state.url.includes('com.reza.tvhome')) throw Error('Unexpected app inspector target.');
    const screenshot = await call('Page.captureScreenshot', {format:'png'});
    const output = path.resolve(__dirname, '../artifacts');
    fs.writeFileSync(path.join(output, 'tv-render.png'), Buffer.from(screenshot.data, 'base64'));
    fs.writeFileSync(path.join(output, 'tv-render-checks.json'), JSON.stringify({observedAt:new Date().toISOString(),...state,exceptionsDuringInspection:exceptions,limits:'Remote app inspection confirms rendering/startup, not physical remote behavior, system telemetry, or cold-boot persistence.'}, null, 2));
    console.log(JSON.stringify({heading:state.heading,tiles:state.tiles,bridge:state.bridge,viewport:state.viewport,userAgent:state.userAgent,exceptionsDuringInspection:exceptions}, null, 2));
    if (state.tiles !== 6 || state.bridge !== 'function') throw Error('Installed app failed startup checks. See saved TV-render evidence.');
  } catch (e) { console.error(e); process.exitCode = 1; }
  finally {
    for (const item of pending.values()) clearTimeout(item.timeout);
    socket.close();
    // Some old TV inspector servers never finish a WebSocket close handshake.
    setTimeout(() => process.exit(process.exitCode || 0), 500);
  }
});
