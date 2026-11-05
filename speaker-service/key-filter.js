// Inserted into the C1 systemUi filter. Only the three audio keys are handled.
var personalSpeaker={enabled:false,available:false,seen:0,muteAt:0,timer:null,pending:false};
function personalSpeakerCall(route,value,callback){
    try{
        var x=new XMLHttpRequest();x.open(value?'POST':'GET','http://127.0.0.1:41273/'+route,true);
        x.setRequestHeader('X-Speaker-Control','__SPEAKER_TOKEN__');
        if(value)x.setRequestHeader('Content-Type','application/json');
        x.onreadystatechange=function(){if(x.readyState!==4)return;try{if(x.status!==200)throw Error();var s=JSON.parse(x.responseText);if(callback)callback(s);}catch(e){personalSpeaker.seen=0;if(callback)callback(null);}};
        x.send(value?JSON.stringify(value):'');
    }catch(e){personalSpeaker.seen=0;if(callback)callback(null);}
}
function personalSpeakerStatus(){
    if(personalSpeaker.pending)return;personalSpeaker.pending=true;
    personalSpeakerCall('status',null,function(s){personalSpeaker.pending=false;if(s&&s.returnValue===true){personalSpeaker.enabled=s.enabled===true;personalSpeaker.available=s.available===true;personalSpeaker.seen=Date.now();}});
}
function personalSpeakerInit(){
    try{
        personalSpeaker.timer=Qt.createQmlObject('import QtQuick 2.0; Timer { interval: 400; repeat: true; running: true }',Qt.application,'personalSpeakerPulse');
        personalSpeaker.timer.triggered.connect(personalSpeakerStatus);personalSpeakerStatus();
    }catch(e){personalSpeaker.seen=0;}
}
function personalSpeakerSend(key,pressed){personalSpeakerCall('key',{key:key,pressed:!!pressed},function(s){if(s&&s.returnValue===true&&typeof s.enabled==='boolean'){personalSpeaker.enabled=s.enabled;personalSpeaker.available=s.available===true;personalSpeaker.seen=Date.now();}personalSpeakerStatus();});}
function personalSpeakerKey(key,pressed,autoRepeat){

    if(key!==Qt.Key_VolumeUp&&key!==Qt.Key_VolumeDown&&key!==Qt.Key_VolumeMute)return KeyPolicy.NextPolicy;
    if(Date.now()-personalSpeaker.seen>1800){personalSpeaker.muteAt=0;return KeyPolicy.NextPolicy;}
    if(key===Qt.Key_VolumeMute){
        if(pressed){if(!autoRepeat&&!personalSpeaker.muteAt)personalSpeaker.muteAt=Date.now();return KeyPolicy.Accepted;}
        if(autoRepeat)return KeyPolicy.Accepted;
        var held=personalSpeaker.muteAt?Date.now()-personalSpeaker.muteAt:0;personalSpeaker.muteAt=0;
        if(held>=1800){personalSpeakerSend('toggle',true);return KeyPolicy.Accepted;}
        if(personalSpeaker.enabled&&personalSpeaker.available){personalSpeakerSend('mute',true);return KeyPolicy.Accepted;}
        return KeyPolicy.NextPolicy;
    }
    if(!personalSpeaker.enabled||!personalSpeaker.available)return KeyPolicy.NextPolicy;
    if(!autoRepeat||pressed)personalSpeakerSend(key===Qt.Key_VolumeUp?'up':'down',pressed);
    return KeyPolicy.Accepted;
}
