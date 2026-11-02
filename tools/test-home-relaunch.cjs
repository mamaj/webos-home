// Exercise the actual event handler with its UI dependencies isolated.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').resolve(__dirname,'../personal-home/app.js'),'utf8');
const match=/  function handleRelaunch\(\) \{[\s\S]*?\n  \}/.exec(source);assert.ok(match);
function fixture(page,validFocus=true,dialog=false){
 const tile={},selected={},backdrop={hidden:!dialog},calls={activate:0,activity:0,render:0,focus:0,close:0};
 const c={page,window:{PalmSystem:{activate(){calls.activate++;}}},document:{activeElement:selected},activity(){calls.activity++;},$:id=>id==='dialog-backdrop'?backdrop:{querySelector:()=>tile},visibleButtons:()=>validFocus?[selected]:[],setPage(p){c.page=p;calls.render++;},focus(){calls.focus++;},closeDialog(){backdrop.hidden=true;calls.close++;}};
 vm.createContext(c);vm.runInContext(match[0],c);return {c,calls};
}
let f=fixture('favorites');f.c.handleRelaunch();f.c.handleRelaunch();assert.equal(f.calls.render,0);assert.equal(f.calls.focus,0);assert.equal(f.calls.activate,2);
f=fixture('apps');f.c.handleRelaunch();f.c.handleRelaunch();assert.equal(f.calls.render,1);assert.equal(f.calls.focus,1);assert.equal(f.c.page,'favorites');
f=fixture('favorites',false);f.c.handleRelaunch();assert.equal(f.calls.render,0);assert.equal(f.calls.focus,1);
f=fixture('favorites',true,true);f.c.handleRelaunch();f.c.handleRelaunch();assert.equal(f.calls.close,1);assert.equal(f.calls.render,0);
console.log('PASS repeated Home activation preserves browsing; secondary pages, dialogs and lost focus remain handled.');
