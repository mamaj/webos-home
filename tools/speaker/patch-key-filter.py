"""Generate a RAM-overlay key filter without storing LG firmware in the repo."""
from pathlib import Path
import sys
original=Path(sys.argv[1]).read_text()
import json,re
token=json.loads(Path(sys.argv[3]).read_text())['controlToken']
assert re.fullmatch(r'[a-f0-9]{64}',token),'Invalid local capability token'
assert 'personalSpeakerKey' not in original, 'Use the pristine backup, not a patched filter'
init='function init() {'
handler='function handleScreenSaver(key, pressed, autoRepeat) {'
assert original.count(init)==1 and original.count(handler)==1, 'Unsupported firmware key-filter layout'
custom=(Path(__file__).resolve().parents[2]/'speaker-service/key-filter.js').read_text().replace('__SPEAKER_TOKEN__',token)
patched=original.replace(init,init+'\n    personalSpeakerInit();',1)
patched=patched.replace(handler,handler+'\n    var speakerResult=personalSpeakerKey(key,pressed,autoRepeat);\n    if(speakerResult===KeyPolicy.Accepted)return speakerResult;',1)
Path(sys.argv[2]).write_text(patched+'\n'+custom)
