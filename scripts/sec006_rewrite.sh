#!/bin/bash
set -e
cd /opt/tradereplay-sec006
git filter-repo --replace-text /tmp/cred_replace.txt --message-callback 'return message.replace(b"PCDWC3C4U8HZ5G98", b"***REDACTED_AV_KEY***")' --force
count=$(git log --all -p 2>/dev/null | grep -c 'PCDWC3C4U8HZ5G98' || true)
echo COUNT=$count
