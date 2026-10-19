// Manual deployment safety timer only. Never started by normal startup.
// Contains no provider token, seal key, unseal or root-generation operation.
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const label = 'myims.openbao.recovery.operation';
function watcherState(pid) {
  const value = readFileSync(`/proc/${pid}/stat`, 'utf8');
  const fields = value.slice(value.lastIndexOf(')') + 2).split(' ');
  return { state: fields[0], startTime: fields[19] };
}
function liveWatcher(ready) {
  try {
    if (!Number.isInteger(ready.watcherPid) || ready.watcherPid < 2)
      return false;
    const actual = watcherState(ready.watcherPid);
    return (
      !['Z', 'X'].includes(actual.state) &&
      /^[0-9]+$/.test(actual.startTime) &&
      actual.startTime === ready.watcherStartTime
    );
  } catch {
    return false;
  }
}
export function recoveryContainerIds(output) {
  const ids = output.trim() ? output.trim().split(/\s+/) : [];
  if (ids.length > 1 || ids.some((id) => !/^[a-f0-9]{64}$/.test(id)))
    throw new Error('Ambiguous recovery ownership');
  return ids;
}
export function recoveryDeadline(value, now = Date.now()) {
  const deadline = Date.parse(value);
  if (
    !Number.isFinite(deadline) ||
    deadline - now < 30000 ||
    deadline - now > 900000
  )
    throw new Error('Invalid recovery deadline');
  return deadline;
}
async function main() {
  process.umask(0o077);
  const [action, operationId, value] = process.argv.slice(2);
  if (process.argv.length !== 5 || !uuid.test(operationId ?? ''))
    throw new Error();
  if (action === 'start') {
    const deadline = recoveryDeadline(value);
    const directory = mkdtempSync(
      join(tmpdir(), `myims-recovery-deadline-${operationId}-`),
    );
    writeFileSync(
      join(directory, 'operation.json'),
      JSON.stringify({ operationId, deadline }),
      { mode: 0o600, flag: 'wx' },
    );
    const child = spawn(
      process.execPath,
      [fileURLToPath(import.meta.url), 'watch', operationId, directory],
      { detached: true, stdio: 'ignore' },
    );
    let failed = false;
    child.on('error', () => {
      failed = true;
    });
    child.unref();
    for (let n = 0; n < 100; n++) {
      if (failed) throw new Error();
      if (existsSync(join(directory, 'ready'))) {
        const ready = JSON.parse(
          readFileSync(join(directory, 'ready'), 'utf8'),
        );
        if (
          ready.watcherPid !== child.pid ||
          !liveWatcher(ready) ||
          ready.operationId !== operationId ||
          existsSync(join(directory, 'outcome.json')) ||
          Date.now() >= deadline - 15000
        )
          throw new Error();
        console.log(
          JSON.stringify({
            state: 'deadline_armed',
            operationId,
            directory,
            watcherPid: child.pid,
            deadline: new Date(deadline).toISOString(),
          }),
        );
        return;
      }
      await delay(50);
    }
    throw new Error();
  }
  if (
    !['watch', 'cancel', 'assert-ready'].includes(action) ||
    !value ||
    process.argv.length !== 5
  )
    throw new Error();
  const record = JSON.parse(
    readFileSync(join(value, 'operation.json'), 'utf8'),
  );
  if (
    record.operationId !== operationId ||
    !Number.isFinite(record.deadline) ||
    record.deadline - Date.now() > 900000
  )
    throw new Error();
  if (action === 'cancel') {
    // Invoke only AFTER verified root revocation and normal service restoration.
    writeFileSync(join(value, 'cancelled'), 'confirmed restoration\n', {
      mode: 0o600,
      flag: 'wx',
    });
    console.log(JSON.stringify({ state: 'deadline_cancelled', operationId }));
    return;
  }
  if (action === 'assert-ready') {
    const ready = JSON.parse(readFileSync(join(value, 'ready'), 'utf8'));
    if (
      ready.operationId !== operationId ||
      !Number.isInteger(ready.watcherPid) ||
      ready.watcherPid < 2 ||
      !liveWatcher(ready) ||
      Date.now() >= record.deadline - 15000 ||
      existsSync(join(value, 'cancelled')) ||
      existsSync(join(value, 'outcome.json'))
    )
      throw new Error();
    process.kill(ready.watcherPid, 0);
    console.log(JSON.stringify({ state: 'deadline_ready', operationId }));
    return;
  }
  const stop = () => {
    if (
      existsSync(join(value, 'cancelled')) ||
      existsSync(join(value, 'outcome.json'))
    )
      return;
    try {
      const ids = recoveryContainerIds(
        execFileSync(
          'docker',
          [
            'ps',
            '--no-trunc',
            '--filter',
            `label=${label}=${operationId}`,
            '--format',
            '{{.ID}}',
          ],
          {
            encoding: 'utf8',
            timeout: 5000,
            stdio: ['ignore', 'pipe', 'pipe'],
          },
        ),
      );
      for (const id of ids)
        execFileSync('docker', ['stop', '--time', '5', id], {
          timeout: 10000,
          stdio: 'ignore',
        });
      writeFileSync(
        join(value, 'outcome.json'),
        JSON.stringify({
          operationId,
          state: ids.length
            ? 'recovery_container_stopped'
            : 'no_running_owned_container',
        }),
        { mode: 0o600, flag: 'wx' },
      );
    } catch {
      writeFileSync(
        join(value, 'outcome.json'),
        JSON.stringify({
          operationId,
          state: 'stop_uncertain_manual_resolution_required',
        }),
        { mode: 0o600, flag: 'wx' },
      );
    }
  };
  // Unexpected watchdog termination also stops its exclusively tagged container.
  process.on('SIGTERM', () => {
    stop();
    process.exit(1);
  });
  process.on('SIGINT', () => {
    stop();
    process.exit(1);
  });
  writeFileSync(
    join(value, 'ready'),
    JSON.stringify({
      operationId,
      watcherPid: process.pid,
      watcherStartTime: watcherState(process.pid).startTime,
    }),
    { mode: 0o600, flag: 'wx' },
  );
  // Allow discovery and Docker's graceful-stop interval within the 15-minute window.
  while (Date.now() < record.deadline - 15000) {
    if (existsSync(join(value, 'cancelled'))) return;
    await delay(
      Math.min(1000, Math.max(1, record.deadline - 15000 - Date.now())),
    );
  }
  stop();
}
if (process.argv[1] === fileURLToPath(import.meta.url))
  main().catch(() => {
    console.error(
      JSON.stringify({
        state: 'failed',
        failureCode: 'recovery_deadline_not_confirmed',
      }),
    );
    process.exitCode = 1;
  });
