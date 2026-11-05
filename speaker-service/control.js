'use strict';
function Control(options){this.device=options.device;this.enabled=!!options.enabled;this.persist=options.persist;this.persistMute=options.persistMute||function(){};this.restoreVolume=Number.isInteger(options.restoreVolume)&&options.restoreVolume>=0&&options.restoreVolume<=100?options.restoreVolume:null;this.publish=options.publish||function(){};this.notify=options.notify||function(){};this.now=options.now||Date.now;this.volume=null;this.mute=false;this.input='Speaker';this.available=false;this.pending=0;this.mutePending=false;this.busy=false;this.held=null;this.heldAt=0;this.repeat=null;this.firstRepeat=null;this.lastToggle=0;this.lastMute=0;}
Control.prototype.snapshot=function(){return {enabled:this.enabled,available:this.available,volume:this.volume,mute:this.mute,input:this.input};};
Control.prototype.emit=function(){this.publish(this.snapshot());};
Control.prototype.stopHold=function(){clearTimeout(this.firstRepeat);clearInterval(this.repeat);this.firstRepeat=null;this.repeat=null;this.held=null;};
Control.prototype.failed=function(){this.available=false;this.pending=0;this.mutePending=false;this.stopHold();this.device.verified=false;this.emit();};
Control.prototype.rememberMute=function(n){this.persistMute(n);this.restoreVolume=n;};
Control.prototype.update=function(s){if(this.restoreVolume!==null&&s.volume!==0)this.rememberMute(null);this.mute=this.restoreVolume!==null&&s.volume===0;this.volume=this.mute?this.restoreVolume:s.volume;this.input=s.input;this.inputId=s.inputId||null;this.available=true;this.emit();};
Control.prototype.flush=function(){if(!this.enabled||!this.available)return;if(this.mutePending){this.mutePending=false;this.toggleMute(true);}else if(this.pending)this.drain();};
Control.prototype.refresh=async function(){if(this.busy)return;this.busy=true;try{this.update(await this.device.status());}catch(e){this.failed();}finally{this.busy=false;this.flush();}};
Control.prototype.toggle=function(){if(this.now()-this.lastToggle<500)return;this.lastToggle=this.now();var value=!this.enabled;this.persist(value);this.enabled=value;this.pending=0;this.mutePending=false;this.stopHold();this.emit();this.notify({message:value?(this.available?'Edifier control on':'Edifier unavailable — LG controls active'):'LG volume controls restored'});};
Control.prototype.adjust=function(delta){if(!this.enabled||!this.available)return;this.pending=Math.max(-20,Math.min(20,this.pending+delta));this.drain();};
Control.prototype.drain=async function(){if(this.busy||!this.pending)return;this.busy=true;var delta=this.pending;this.pending=0;
 try{var s=await this.device.status();if(!this.enabled)return;var base=this.restoreVolume!==null&&s.volume===0?this.restoreVolume:s.volume,target=Math.max(0,Math.min(100,base+delta));await this.device.setVolume(target);var actual=await this.device.status();if(actual.volume!==target)throw Error('Volume readback mismatch');this.rememberMute(null);this.update(actual);if(this.enabled)this.notify(this.snapshot());}catch(e){this.failed();this.notify({message:'Speaker unavailable — LG controls active'});}finally{this.busy=false;this.flush();}
};
Control.prototype.toggleMute=async function(queued){if(!this.enabled||!this.available||(!queued&&this.now()-this.lastMute<250))return;if(!queued)this.lastMute=this.now();this.pending=0;this.stopHold();if(this.busy){this.mutePending=!this.mutePending;return;}this.busy=true;
 try{var s=await this.device.status();if(!this.enabled)return;var restoring=this.restoreVolume!==null&&s.volume===0,target=restoring?this.restoreVolume:0;if(!restoring)this.rememberMute(s.volume);await this.device.setVolume(target);var actual=await this.device.status();if(actual.volume!==target)throw Error('Mute volume readback mismatch');if(restoring)this.rememberMute(null);this.update(actual);if(this.enabled)this.notify(this.snapshot());}catch(e){this.failed();this.notify({message:'Speaker unavailable — LG controls active'});}finally{this.busy=false;this.flush();}
};
Control.prototype.key=function(k,pressed){
 var self=this;if(k==='toggle'){if(pressed)this.toggle();return;}
 if(k==='mute'){if(pressed)this.toggleMute();return;}
 if(k!=='up'&&k!=='down')return;
 if(!pressed){if(this.held===k)this.stopHold();return;}
 if(!this.enabled||!this.available)return;
 this.heldAt=this.now();if(this.held===k)return;this.stopHold();this.held=k;this.adjust(k==='up'?5:-5);
 this.firstRepeat=setTimeout(function(){self.adjust(self.held==='up'?5:-5);self.repeat=setInterval(function(){if(!self.enabled||!self.available||self.now()-self.heldAt>1800){self.stopHold();return;}self.adjust(self.held==='up'?5:-5);},300);},350);
};
module.exports={Control:Control};
