// Bypass LG's built-in long-Mute timer only while our audio service is healthy.
var personalSpeakerAccess={seen:0,enabled:false,available:false,pending:false,owned:false,downAt:0,longReleased:false,timer:null};
function personalSpeakerAccessStatus(){
    if(personalSpeakerAccess.pending)return;personalSpeakerAccess.pending=true;
    try{var x=new XMLHttpRequest();x.open('GET','http://127.0.0.1:41273/status',true);x.setRequestHeader('X-Speaker-Control','__SPEAKER_TOKEN__');x.onreadystatechange=function(){if(x.readyState!==4)return;personalSpeakerAccess.pending=false;try{if(x.status!==200)throw Error();var s=JSON.parse(x.responseText);if(s.returnValue!==true)throw Error();personalSpeakerAccess.seen=Date.now();personalSpeakerAccess.enabled=s.enabled===true;personalSpeakerAccess.available=s.available===true;}catch(e){personalSpeakerAccess.seen=0;}};x.send('');}catch(e){personalSpeakerAccess.pending=false;personalSpeakerAccess.seen=0;}
}
function personalSpeakerAccessInit(){try{personalSpeakerAccess.timer=Qt.createQmlObject('import QtQuick 2.0; Timer { interval: 400; repeat: true; running: true }',Qt.application,'personalSpeakerAccessPulse');personalSpeakerAccess.timer.triggered.connect(personalSpeakerAccessStatus);personalSpeakerAccessStatus();}catch(e){personalSpeakerAccess.seen=0;}}
function personalSpeakerAccessMute(key,pressed,autoRepeat){
    if(key!==Qt.Key_VolumeMute)return false;
    if(pressed&&!autoRepeat){personalSpeakerAccess.longReleased=false;personalSpeakerAccess.downAt=Date.now();}
    var fresh=Date.now()-personalSpeakerAccess.seen<=1800;
    if(fresh&&pressed)personalSpeakerAccess.owned=true;
    if(!fresh&&!personalSpeakerAccess.owned)return false;
    if(longPressTimer.isRunning(key))longPressTimer.cancel();
    if(!pressed&&!autoRepeat){personalSpeakerAccess.longReleased=personalSpeakerAccess.owned&&Date.now()-personalSpeakerAccess.downAt>=1800;personalSpeakerAccess.owned=false;}
    return true;
}
function personalSpeakerAccessSkipReset(key,pressed){
    if(key!==Qt.Key_VolumeMute||pressed)return false;
    return personalSpeakerAccess.longReleased||(personalSpeakerAccess.owned&&Date.now()-personalSpeakerAccess.downAt>=1800)||(Date.now()-personalSpeakerAccess.seen<=1800&&personalSpeakerAccess.enabled&&personalSpeakerAccess.available);
}
