#!/usr/bin/env bash
# One-time server setup for AniKumo (Debian). Run as root from a checkout of this repo:
#   sudo bash deploy/setup-server.sh keygen        # 1. make the read-only GitHub deploy key, prints it
#   sudo bash deploy/setup-server.sh install <git-ssh-url>   # 2. after adding the key on GitHub
# Safe to re-run. Never overwrites an existing /etc/anikumo/anikumo.env or database.
set -euo pipefail

APP=/opt/anikumo
DATA=/var/lib/anikumo
HERE=$(cd "$(dirname "$0")" && pwd)

ensure_user() {
  id anikumo >/dev/null 2>&1 || useradd --system --home-dir "$APP" --shell /usr/sbin/nologin anikumo
  install -d -o anikumo -g anikumo -m 750 "$APP" "$APP/releases" "$APP/.ssh"
  install -d -o anikumo -g anikumo -m 750 "$DATA" "$DATA/backups"
  install -d -o root -g root -m 755 "$APP/bin"
}

case "${1:-}" in
  keygen)
    ensure_user
    if [[ ! -f "$APP/.ssh/deploy_key" ]]; then
      runuser -u anikumo -- ssh-keygen -q -t ed25519 -N "" -C "anikumo-deploy@$(hostname)" -f "$APP/.ssh/deploy_key"
    fi
    runuser -u anikumo -- bash -c "ssh-keyscan -t ed25519 github.com > '$APP/.ssh/known_hosts' 2>/dev/null"
    cat "$APP/.ssh/deploy_key.pub"
    ;;

  install)
    URL=${2:?usage: setup-server.sh install git@github.com:OWNER/REPO.git}
    ensure_user

    # Secrets: generated here, readable by root only, never in git.
    install -d -m 750 -o root -g root /etc/anikumo
    if [[ ! -f /etc/anikumo/anikumo.env ]]; then
      umask 077
      cat > /etc/anikumo/anikumo.env <<EOF
# AniKumo production settings. Overrides the .env committed in git. Root-only.
NODE_ENV=production
DATABASE_URL="file:$DATA/anikumo.db"
AUTH_SECRET="$(openssl rand -base64 48 | tr -d '\n')"
APP_URL="https://anikumo.cc"
TRUSTED_IP_HEADER="cf-connecting-ip"
ADMIN_USERNAMES="mixe"
BACKUP_DIR="$DATA/backups"
LIBRARY_DIR=""
REMOTE_EMBEDS_ENABLED="true"
NEXT_TELEMETRY_DISABLED=1
EOF
      chmod 600 /etc/anikumo/anikumo.env
      echo "created /etc/anikumo/anikumo.env"
    fi

    SSH_CMD="ssh -i $APP/.ssh/deploy_key -o IdentitiesOnly=yes -o UserKnownHostsFile=$APP/.ssh/known_hosts"
    if [[ ! -d "$APP/repo/.git" ]]; then
      runuser -u anikumo -- env GIT_SSH_COMMAND="$SSH_CMD" git clone --quiet --no-checkout "$URL" "$APP/repo"
    fi
    runuser -u anikumo -- git -C "$APP/repo" config core.sshCommand "$SSH_CMD"
    runuser -u anikumo -- git -C "$APP/repo" remote set-url origin "$URL"

    install -m 755 "$HERE/deploy.sh" "$APP/bin/deploy.sh"
    for u in anikumo.service anikumo-deploy.service anikumo-deploy.timer anikumo-backup.service anikumo-backup.timer cloudflared-anikumo.service; do
      install -m 644 "$HERE/$u" "/etc/systemd/system/$u"
    done
    systemctl daemon-reload
    systemctl enable anikumo.service >/dev/null

    "$APP/bin/deploy.sh" --force
    systemctl enable --now anikumo-deploy.timer anikumo-backup.timer >/dev/null

    if [[ -s /etc/cloudflared/anikumo.token ]]; then
      chmod 600 /etc/cloudflared/anikumo.token
      systemctl enable --now cloudflared-anikumo.service >/dev/null
      echo "tunnel started"
    else
      echo "NOTE: put the tunnel token in /etc/cloudflared/anikumo.token, then: systemctl enable --now cloudflared-anikumo"
    fi
    echo "done: http://127.0.0.1:3100"
    ;;

  *)
    sed -n '2,6p' "$0"
    exit 1
    ;;
esac
