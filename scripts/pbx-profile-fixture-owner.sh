#!/bin/sh
set -eu
umask 077
node_id=$(node -e 'const c=JSON.parse(require("node:fs").readFileSync("/run/pbx-live-native/configuration.json","utf8"));if(!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(c.nodeId))process.exit(1);process.stdout.write(c.nodeId)')
control_dir="/var/lib/myims-pbx/control/$node_id"
mkdir -p "$control_dir"
chmod 700 "$control_dir"
exec 3>"$control_dir/boundary.lock"
flock -n 3 || exit 1
exec node /fixture-native.mjs
