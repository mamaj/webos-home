#!/usr/bin/python
"""Test-only: inject one whitelisted source-picker key; never grab or relay a device."""
import os,struct,time,sys,re
key=int(sys.argv[1]);hold=int(sys.argv[2])
if key not in (400,103,108,105,106,28) or not 40<=hold<=2300:raise SystemExit('Invalid picker test')
blocks=open('/proc/bus/input/devices').read().split('\n\n');device=None
for b in blocks:
    if 'Name="LGE RCU"' in b:
        m=re.search(r'Handlers=.*\b(event\d+)\b',b)
        if m:device='/dev/input/'+m.group(1)
if device is None:raise SystemExit('No designated LG remote test device')
fd=os.open(device,os.O_WRONLY)
def send(kind,code,value):os.write(fd,struct.pack('llHHi',0,0,kind,code,value))
try:
    send(1,key,1);send(0,0,0);time.sleep(hold/1000.0)
finally:
    send(1,key,0);send(0,0,0);os.close(fd)
