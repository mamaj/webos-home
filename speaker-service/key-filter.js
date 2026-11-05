// Inserted into the C1 systemUi filter. Audio keys and the explicitly opened source picker only.
var personalSpeaker={enabled:false,available:false,seen:0,muteAt:0,timer:null,pending:false,pickerOpen:false,yellowAt:0,ownedKeys:{}};
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
    personalSpeakerCall('status',null,function(s){personalSpeaker.pending=false;if(s&&s.returnValue===true){personalSpeaker.enabled=s.enabled===true;personalSpeaker.available=s.available===true;personalSpeaker.seen=Date.now();personalSpeaker.pickerOpen=s.pickerOpen===true;}});
}
function personalSpeakerInit(){
    try{
        personalSpeaker.timer=Qt.createQmlObject('import QtQuick 2.0; Timer { interval: 400; repeat: true; running: true }',Qt.application,'personalSpeakerPulse');
        personalSpeaker.timer.triggered.connect(personalSpeakerStatus);personalSpeakerStatus();
    }catch(e){personalSpeaker.seen=0;}
}
function personalSpeakerSend(key,pressed){personalSpeakerCall('key',{key:key,pressed:!!pressed},function(s){if(s&&s.returnValue===true&&typeof s.enabled==='boolean'){personalSpeaker.enabled=s.enabled;personalSpeaker.available=s.available===true;personalSpeaker.seen=Date.now();personalSpeaker.pickerOpen=s.pickerOpen===true;}personalSpeakerStatus();});}
function personalSpeakerKey(key,pressed,autoRepeat){
    var sourceResult=personalSpeakerSourceKey(key,pressed,autoRepeat);if(sourceResult===KeyPolicy.Accepted)return sourceResult;

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

function personalSpeakerSourceKey(key,pressed,autoRepeat){
    var p=personalSpeaker,now=Date.now(),fresh=now-p.seen<=1800;
    if(!pressed&&!autoRepeat&&p.ownedKeys[key]){delete p.ownedKeys[key];return KeyPolicy.Accepted;}
    if(key===WebOS.Key_webOS_Yellow&&((fresh&&p.enabled&&p.available)||p.yellowAt)){
        if(pressed){if(!autoRepeat&&!p.yellowAt)p.yellowAt=now;return KeyPolicy.Accepted;}
        if(autoRepeat)return KeyPolicy.Accepted;
        var held=p.yellowAt?now-p.yellowAt:0;p.yellowAt=0;
        if(held>=1200){personalSpeakerSend('source-open',true);return KeyPolicy.Accepted;}
        try{var nativeKey=global.qtKeycodeToNativeKeycode(key);global.sendKeyToFocusWindow(key,true,nativeKey);global.sendKeyToFocusWindow(key,false,nativeKey);}catch(e){}
        return KeyPolicy.Accepted;
    }
    if(!fresh||!p.pickerOpen)return KeyPolicy.NextPolicy;
    var action=null;
    if(key===Qt.Key_Up||key===Qt.Key_Left)action='source-prev';
    else if(key===Qt.Key_Down||key===Qt.Key_Right)action='source-next';
    else if(key===Qt.Key_Return||key===Qt.Key_Enter)action='source-apply';
    else if(key===WebOS.Key_webOS_Back||key===Qt.Key_Escape)action='source-close';
    else if(key===Qt.Key_Super_L||key===Qt.Key_Menu){if(pressed)personalSpeakerSend('source-close',true);return KeyPolicy.NextPolicy;}
    if(!action)return KeyPolicy.NextPolicy;
    if(pressed){p.ownedKeys[key]=true;if(!autoRepeat||action==='source-prev'||action==='source-next')personalSpeakerSend(action,true);}
    return KeyPolicy.Accepted;
}
