#!/bin/sh
sleep 600
if [ ! -f /tmp/reza-speaker-control/accepted ]; then
 sh /var/lib/webosbrew/reza-speaker-v1/disable.sh
 systemctl restart surface-manager || true
fi
