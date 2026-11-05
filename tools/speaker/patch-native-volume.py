"""C1-only private RAM overlay: pass volume up/down to the normal Qt key filters.

Never distributes the LG plugin. Refuses any different firmware binary.
The two Thumb conditional branches consume Linux 115/114 in the native fast
path. Replacing them with NOPs selects the existing unhandled-key return path.
Mute and all other native key branches retain their original bytes.
"""
from pathlib import Path
import hashlib, sys
EXPECTED='a678c40452c2772e3aa46c63d3475aae51686b65dd894f3887c7e52ce71a85c6'
b=bytearray(Path(sys.argv[1]).read_bytes())
assert hashlib.sha256(b).hexdigest()==EXPECTED,'Unsupported keyboard plugin; no patch made'
for offset,expected in [(0x32546,bytes.fromhex('00f01381')),(0x32552,bytes.fromhex('00f09880'))]:
    assert b[offset:offset+4]==expected,'Unexpected native volume branch'
    b[offset:offset+4]=bytes.fromhex('00bf00bf')
Path(sys.argv[2]).write_bytes(b)
