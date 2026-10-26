#!/bin/sh
set -eu
umask 077
/usr/sbin/asterisk -f -U asterisk &
pbx_pid=$!
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
# Helper loss must not stop the PBX or forcibly end existing calls. Restart a
# fresh child, which cannot acquire FD 3 while a dispatched guardian still lives.
# Direct AMI TLS remains disabled; the read-only gateway is unavailable until then.
while kill -0 "$pbx_pid" 2>/dev/null; do
  if ! kill -0 "$native_pid" 2>/dev/null; then
    wait "$native_pid" 2>/dev/null || true
    /bin/sh /usr/local/lib/myims/native-owner.sh &
    native_pid=$!
  fi
  sleep 1
done
shutdown
exit 1
