#!/usr/bin/env bash
# Sync this working tree to server 192.168.1.129, then rebuild and restart VClinks there.
#   tools/deploy/server-129/sync.sh          rebuild and restart every service
#   tools/deploy/server-129/sync.sh web      only the listed services (a UI change leaves the API running)
# Server layout: ~/vclinks/.env (secrets, kept across syncs), ~/vclinks/app (code, replaced every sync).
set -euo pipefail
HOST=${VCLINKS_DEPLOY_HOST:-ssh-local-192-1-129}
cd "$(git rev-parse --show-toplevel)"
services=$(printf ' %q' "$@")

# Snapshot of the working tree (tracked + untracked, not ignored) through a throwaway index, so the real
# index is untouched: .env, node_modules and dist never leave this machine. core.autocrlf=false keeps the blobs' LF
# endings: with the Windows default (true) git archive writes CRLF, which breaks the shell scripts in the images.
idx=$(mktemp)
trap 'rm -f "$idx"' EXIT
cp "$(git rev-parse --git-path index)" "$idx"
tree=$(GIT_INDEX_FILE="$idx" git add -A && GIT_INDEX_FILE="$idx" git write-tree)

git -c core.autocrlf=false archive --format=tar.gz "$tree" | ssh "$HOST" 'set -e
  mkdir -p ~/vclinks && cd ~/vclinks
  [ -f .env ] || { echo "~/vclinks/.env missing on the server" >&2; exit 1; }
  rm -rf app.new && mkdir app.new && tar -xzf - -C app.new
  rm -rf app.old && if [ -d app ]; then mv app app.old; fi && mv app.new app
  cd app/tools/deploy/server-129 && ln -sf ~/vclinks/.env .env
  docker compose up -d --build --force-recreate --remove-orphans'"${services}"'
  docker compose ps'
