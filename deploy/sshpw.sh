#!/usr/bin/env bash
# Turns on SSH password login (keys keep working too) and restarts sshd.
# Run on the server: sudo bash /opt/anikumo/current/deploy/sshpw.sh
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo "Run it with sudo: sudo bash $0"; exit 1; }

# Flip any line that turns passwords off, wherever it is (main file, drop-ins, Match blocks),
# and drop AuthenticationMethods, which can force keys only.
for f in /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf; do
  [[ -f "$f" ]] || continue
  sed -i -E 's/^\s*(PasswordAuthentication|KbdInteractiveAuthentication)\s.*/\1 yes/I; s/^\s*AuthenticationMethods\s.*/#&/I' "$f"
done
# sshd keeps the first value it reads, and 00- is read first.
printf 'PasswordAuthentication yes\nKbdInteractiveAuthentication yes\n' > /etc/ssh/sshd_config.d/00-password.conf

sshd -t
systemctl restart ssh
sshd -T | grep -iE '^(passwordauthentication|kbdinteractiveauthentication) '
echo "Password login is on. From the Windows PC: ssh -b 192.168.1.103 ryn@192.168.1.102"
