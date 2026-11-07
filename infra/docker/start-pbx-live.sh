#!/bin/sh
set -eu
umask 077
node_id=$(node -e 'const c=JSON.parse(require("node:fs").readFileSync("/run/pbx-live-native/configuration.json","utf8"));if(!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(c.nodeId))process.exit(1);process.stdout.write(c.nodeId)')
control_dir="/var/lib/myims-pbx/control/$node_id"
start_pbx() {
  launch=$(node /usr/local/lib/myims/pbx-profile-launch.mjs)
  /usr/sbin/asterisk -C "$launch" -f -U asterisk &
  pbx_pid=$!
}
start_pbx
# This child opens FD 3. The supervisor and Asterisk must never inherit/reuse it.
/bin/sh /usr/local/lib/myims/native-owner.sh &
native_pid=$!
shutdown() {
  trap - TERM INT
  kill -TERM "$native_pid" 2>/dev/null || true
  wait "$native_pid" 2>/dev/null || true
  kill -TERM "$pbx_pid" 2>/dev/null || true
  wait "$pbx_pid" 2>/dev/null || true
}
trap shutdown TERM INT
while :; do
  if ! kill -0 "$pbx_pid" 2>/dev/null; then
    wait "$pbx_pid" 2>/dev/null || true
    # A root-only, already-dispatched quiet restart is consumed exactly once.
    # Unexpected PBX death cannot replay an old restart request.
    if [ -f "$control_dir/restart-request.json" ]; then
      mv "$control_dir/restart-request.json" "$control_dir/restart-consumed.json"
      start_pbx
    else
      break
    fi
  fi
  if ! kill -0 "$native_pid" 2>/dev/null; then
    wait "$native_pid" 2>/dev/null || true
    /bin/sh /usr/local/lib/myims/native-owner.sh &
    native_pid=$!
  fi
  sleep 1
done
shutdown
exit 1
