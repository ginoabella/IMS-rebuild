#!/bin/sh
set -eu
workspace_uid=${MYIMS_UID:-$(stat -c %u "${MYIMS_OWNER_PATH:-/workspace}")}
workspace_gid=${MYIMS_GID:-$(stat -c %g "${MYIMS_OWNER_PATH:-/workspace}")}
# Keep application processes non-root even when a checkout belongs to root.
[ "$workspace_uid" != 0 ] || workspace_uid=1000
[ "$workspace_gid" != 0 ] || workspace_gid=1000
if [ "$(id -g node)" != "$workspace_gid" ]; then groupmod -o -g "$workspace_gid" node; fi
if [ "$(id -u node)" != "$workspace_uid" ]; then usermod -o -u "$workspace_uid" node; fi
usermod -g "$workspace_gid" node
for directory in /home/node /workspace/node_modules /workspace/apps/command-center-web/node_modules /workspace/apps/platform-console-web/node_modules /workspace/apps/public-web/node_modules /workspace/apps/responder-mobile/node_modules /workspace/apps/public-mobile/node_modules /workspace/packages/config/node_modules /workspace/packages/contracts/node_modules /workspace/packages/ui-web/node_modules /workspace/packages/testkit/node_modules /workspace/services/backend/node_modules /workspace/apps/command-center-web/.next /workspace/apps/platform-console-web/.next /workspace/apps/public-web/.next /home/node/.local/share/pnpm/store; do
  mkdir -p "$directory"
  if [ "$(stat -c %u "$directory")" != "$workspace_uid" ] || [ "$(stat -c %g "$directory")" != "$workspace_gid" ]; then
    chown -R "$workspace_uid:$workspace_gid" "$directory"
  fi
done
export HOME=/home/node
exec gosu node "$@"
