#!/usr/bin/env bash
# AniKumo auto-deploy. Run every minute by anikumo-deploy.timer (as root).
# If the production branch moved: build a fresh release next to the live one, back up the DB,
# run migrations, switch the `current` symlink, restart, and roll back if the site doesn't come up.
# Code lives in /opt/anikumo; the database and secrets never touch git:
#   /var/lib/anikumo/anikumo.db   /var/lib/anikumo/backups/   /etc/anikumo/anikumo.env
# Usage: deploy.sh [--force]
set -euo pipefail

APP=/opt/anikumo
REPO=$APP/repo
BRANCH=${DEPLOY_BRANCH:-production}
PORT=3100
KEEP=3

exec 9>/run/anikumo-deploy.lock
flock -n 9 || exit 0

log() { echo "[deploy] $*"; }
as_app() { runuser -u anikumo -- "$@"; }

set -a
# shellcheck disable=SC1091
. /etc/anikumo/anikumo.env
set +a

as_app git -C "$REPO" fetch --quiet --prune origin "$BRANCH"
NEW=$(as_app git -C "$REPO" rev-parse "origin/$BRANCH")
CUR=$(cat "$APP/current/.release" 2>/dev/null || true)
if [[ "$NEW" == "$CUR" && "${1:-}" != "--force" ]]; then exit 0; fi

log "deploying ${NEW:0:7} (was ${CUR:0:7})"
REL=$APP/releases/$NEW
rm -rf "$REL"
install -d -o anikumo -g anikumo "$REL"
as_app bash -c "git -C '$REPO' archive '$NEW' | tar -x -C '$REL'"

# Reuse dependencies when the lockfile didn't change (a full copy, so the live release is untouched).
if [[ -d "$APP/current/node_modules" ]] && cmp -s "$APP/current/package-lock.json" "$REL/package-lock.json"; then
  log "lockfile unchanged, copying node_modules"
  as_app cp -a "$APP/current/node_modules" "$REL/node_modules"
  as_app bash -c "cd '$REL' && ./node_modules/.bin/prisma generate >/dev/null"
else
  log "installing dependencies"
  as_app bash -c "cd '$REL' && npm ci --include=dev --no-audit --no-fund --loglevel=error"
fi

log "backing up database"
as_app bash -c "cd '$REL' && node scripts/db-backup.mjs"
log "applying migrations"
as_app bash -c "cd '$REL' && ./node_modules/.bin/prisma migrate deploy"
log "building"
as_app bash -c "cd '$REL' && ./node_modules/.bin/next build"
echo "$NEW" > "$REL/.release"
chown anikumo:anikumo "$REL/.release"

PREV=$(readlink -f "$APP/current" 2>/dev/null || true)
ln -sfn "$REL" "$APP/current.tmp" && mv -Tf "$APP/current.tmp" "$APP/current"
systemctl restart anikumo

for _ in $(seq 1 45); do
  if curl -fsS -o /dev/null --max-time 5 "http://127.0.0.1:$PORT/"; then
    log "live: ${NEW:0:7}"
    ls -1dt "$APP"/releases/*/ | tail -n +$((KEEP + 1)) | xargs -r rm -rf
    exit 0
  fi
  sleep 2
done

log "new release did not come up; rolling back"
if [[ -n "$PREV" && -d "$PREV" ]]; then
  ln -sfn "$PREV" "$APP/current.tmp" && mv -Tf "$APP/current.tmp" "$APP/current"
  systemctl restart anikumo
fi
exit 1
