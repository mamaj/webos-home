'use strict';
var inputs=require('./inputs.js');
function Picker(options){this.control=options.control;this.api=options.api;this.render=options.render;this.opened=false;this.index=0;this.busy=false;this.error='';this.last='';this.lastMove=0;this.timeout=null;}
Picker.prototype.snapshot=function(){return {pickerOpen:this.opened};};
Picker.prototype.payload=function(){var c=this.control.snapshot();return Object.assign({},c,{picker:true,sourceIndex:this.index,appliedSource:c.input,sourceId:this.control.inputId||null,switching:this.busy,sourceError:this.error});};
Picker.prototype.sync=function(force){if(!this.opened)return;var value=this.payload(),encoded=JSON.stringify(value);if(force||encoded!==this.last){this.last=encoded;this.render(value);}};
Picker.prototype.keep=function(){var self=this;clearTimeout(this.timeout);this.timeout=setTimeout(function(){if(!self.busy)self.close();else self.keep();},30000);};
Picker.prototype.open=function(){if(!this.control.available)return;this.opened=true;this.error='';this.index=Math.max(0,inputs.map(function(x){return x.id;}).indexOf(this.control.inputId));this.keep();this.sync(true);};
Picker.prototype.close=function(){if(!this.opened)return;this.opened=false;this.error='';clearTimeout(this.timeout);this.render({closePicker:true});};
Picker.prototype.move=function(delta){if(!this.opened||this.busy||Date.now()-this.lastMove<140)return;this.lastMove=Date.now();this.index=(this.index+delta+inputs.length)%inputs.length;this.error='';this.keep();this.sync();};
Picker.prototype.apply=async function(){if(!this.opened||this.busy)return;var id=inputs[this.index].id;if(id===this.control.inputId){this.close();return;}this.busy=true;this.error='';this.sync();var waitUntil=Date.now()+2500;while(this.control.busy&&Date.now()<waitUntil)await new Promise(function(r){setTimeout(r,50);});if(this.control.busy){this.busy=false;this.error='Please try again';this.sync();return;}this.control.busy=true;this.control.stopHold();this.control.pending=0;this.sync();
 try{await this.api.select(id);if(this.control.restoreVolume!==null)await this.control.device.setVolume(0);this.control.update(await this.control.device.status());this.close();}catch(e){this.error='Could not change source. Try again.';try{this.control.update(await this.control.device.status());}catch(ignore){}}finally{this.busy=false;this.control.busy=false;this.control.flush();if(this.opened)this.keep();this.sync();}
};
Picker.prototype.key=function(key){if(key==='source-open')this.open();else if(key==='source-close')this.close();else if(key==='source-next')this.move(1);else if(key==='source-prev')this.move(-1);else if(key==='source-apply')this.apply();};
module.exports={Picker:Picker};
