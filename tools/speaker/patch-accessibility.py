"""Patch only the specific guidance/reset shortcuts in a private firmware copy."""
from pathlib import Path
import sys,json,re
original=Path(sys.argv[1]).read_text();token=json.loads(Path(sys.argv[3]).read_text())['controlToken']
assert re.fullmatch('[a-f0-9]{64}',token)
assert 'personalSpeakerAccess' not in original
anchors=['function init() {','function handleAccessibility(key, pressed, autoRepeat) {','function handleAvReset(key, pressed, autoRepeat) {']
assert all(original.count(a)==1 for a in anchors),'Unsupported key-filter layout'
patched=original.replace(anchors[0],anchors[0]+'\n    personalSpeakerAccessInit();',1)
patched=patched.replace(anchors[1],anchors[1]+'\n    if(personalSpeakerAccessMute(key,pressed,autoRepeat))return KeyPolicy.NextPolicy;',1)
patched=patched.replace(anchors[2],anchors[2]+'\n    if(personalSpeakerAccessSkipReset(key,pressed)){resetMuteCount();return KeyPolicy.NextPolicy;}',1)
custom=(Path(__file__).resolve().parents[2]/'speaker-service/accessibility-filter.js').read_text().replace('__SPEAKER_TOKEN__',token)
Path(sys.argv[2]).write_text(patched+'\n'+custom)
