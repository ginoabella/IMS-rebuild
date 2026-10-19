// Explicit host acceptance: disposable network-none containers only; no OpenBao I/O.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
process.umask(0o077);
const guard = resolve('scripts/openbao/recovery-deadline.mjs');
const image =
  'node:22.23.3-bookworm-slim@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c';
const label = 'myims.openbao.recovery.operation';
const containers = [],
  guards = [],
  parents = [];
const scratch = mkdtempSync(join(tmpdir(), 'myims-deadline-acceptance-'));
function docker(args) {
  return execFileSync('docker', args, {
    encoding: 'utf8',
    timeout: 20000,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}
function state(id) {
  return JSON.parse(docker(['inspect', '--format', '{{json .State}}', id]));
}
function fixture(op) {
  const id = docker([
    'run',
    '-d',
    '--network',
    'none',
    '--read-only',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '--memory',
    '32m',
    '--pids-limit',
    '32',
    '--label',
    `${label}=${op}`,
    '--entrypoint',
    'node',
    image,
    '-e',
    "process.on('SIGTERM',()=>process.exit(0));setInterval(()=>{},1000)",
  ]);
  assert.match(id, /^[a-f0-9]{64}$/);
  containers.push(id);
  const config = JSON.parse(docker(['inspect', id]))[0];
  assert.equal(config.HostConfig.NetworkMode, 'none');
  assert.deepEqual(config.Mounts, []);
  assert.equal(Object.keys(config.NetworkSettings.Ports ?? {}).length, 0);
  return id;
}
async function until(check, limit = 25000) {
  const end = Date.now() + limit;
  while (Date.now() < end) {
    const result = check();
    if (result) return result;
    await delay(100);
  }
  throw new Error('Disposable deadline acceptance timed out');
}
async function arm(
  op,
  { interruptedParent = false, unavailableDocker = false, seconds = 35 } = {},
) {
  const deadline = new Date(Date.now() + seconds * 1000).toISOString();
  // This parent remains alive after start returns, so killing it demonstrates
  // detached survival across an actual launcher SIGKILL, not only a normal exit.
  const wrapper = `const {execFileSync}=require('node:child_process');process.stdout.write(execFileSync(process.execPath,${JSON.stringify([guard, 'start', op, deadline])}));setInterval(()=>{},1000);`;
  const child = spawn(
    process.execPath,
    interruptedParent ? ['-e', wrapper] : [guard, 'start', op, deadline],
    {
      env: {
        ...process.env,
        ...(unavailableDocker
          ? { DOCKER_HOST: `unix://${scratch}/missing.sock` }
          : {}),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  parents.push(child);
  let output = '';
  child.stdout.on('data', (b) => {
    output += b.toString();
  });
  child.stderr.resume();
  await until(() => output.includes('\n'));
  const armed = JSON.parse(output.trim());
  assert.equal(armed.state, 'deadline_armed');
  assert.equal(armed.operationId, op);
  assert.ok(Number.isInteger(armed.watcherPid) && armed.watcherPid > 1);
  guards.push(armed);
  const readiness = JSON.parse(
    execFileSync(
      process.execPath,
      [guard, 'assert-ready', op, armed.directory],
      { encoding: 'utf8' },
    ),
  );
  assert.equal(readiness.state, 'deadline_ready');
  if (interruptedParent) child.kill('SIGKILL');
  else await until(() => child.exitCode === 0);
  return armed;
}
async function outcome(g) {
  const value = await until(
    () =>
      existsSync(join(g.directory, 'outcome.json')) &&
      JSON.parse(readFileSync(join(g.directory, 'outcome.json'), 'utf8')),
  );
  assert.equal(value.operationId, g.operationId);
  return value.state;
}
try {
  const decoy = fixture(randomUUID());
  let op = randomUUID(),
    target = fixture(op),
    armed = await arm(op);
  assert.equal(await outcome(armed), 'recovery_container_stopped');
  assert.equal(state(target).Running, false);
  assert.throws(() =>
    execFileSync(
      process.execPath,
      [guard, 'assert-ready', op, armed.directory],
      { stdio: 'ignore' },
    ),
  );
  assert.equal(state(decoy).Running, true);
  assert.ok(
    Date.now() <= Date.parse(armed.deadline),
    'Timeout exceeded declared deadline',
  );
  console.log(
    'PASS deadline: real Docker timeout stops only exact labelled target before deadline; different-operation container survives',
  );

  op = randomUUID();
  target = fixture(op);
  armed = await arm(op, { interruptedParent: true });
  assert.equal(await outcome(armed), 'recovery_container_stopped');
  assert.equal(state(target).Running, false);
  assert.equal(state(decoy).Running, true);
  console.log(
    'PASS interruption: detached guard survives launcher SIGKILL and stops its disposable target',
  );

  op = randomUUID();
  target = fixture(op);
  armed = await arm(op, { seconds: 60 });
  process.kill(armed.watcherPid, 'SIGTERM');
  assert.equal(await outcome(armed), 'recovery_container_stopped');
  assert.equal(state(target).Running, false);
  console.log(
    'PASS interruption: watcher SIGTERM stops its disposable target immediately',
  );

  op = randomUUID();
  target = fixture(op);
  armed = await arm(op, { seconds: 60 });
  process.kill(armed.watcherPid, 'SIGKILL');
  await until(() => {
    try {
      execFileSync(
        process.execPath,
        [guard, 'assert-ready', op, armed.directory],
        { stdio: 'ignore' },
      );
      return false;
    } catch {
      return true;
    }
  });
  assert.equal(state(target).Running, true);
  assert.equal(existsSync(join(armed.directory, 'outcome.json')), false);
  console.log(
    'PASS hard-kill limit: dead/zombie watcher fails readiness, target remains running and requires manual resolution; no false stop claim',
  );

  op = randomUUID();
  target = fixture(op);
  armed = await arm(op, { unavailableDocker: true });
  assert.equal(
    await outcome(armed),
    'stop_uncertain_manual_resolution_required',
  );
  assert.equal(state(target).Running, true);
  console.log(
    'PASS failure: unavailable Docker socket records uncertainty; no false stopped/restored claim',
  );

  op = randomUUID();
  target = fixture(op);
  const duplicate = fixture(op);
  armed = await arm(op);
  assert.equal(
    await outcome(armed),
    'stop_uncertain_manual_resolution_required',
  );
  assert.equal(state(target).Running, true);
  assert.equal(state(duplicate).Running, true);
  assert.equal(state(decoy).Running, true);
  console.log(
    'PASS ownership: duplicate operation targets report uncertainty and neither is guessed or stopped',
  );
} finally {
  // Stop watchers before removing their owned containers; never target retained services.
  for (const g of guards) {
    try {
      if (!existsSync(join(g.directory, 'outcome.json'))) {
        execFileSync(
          process.execPath,
          [guard, 'cancel', g.operationId, g.directory],
          { stdio: 'ignore' },
        );
        process.kill(g.watcherPid, 'SIGTERM');
      }
    } catch {
      /* Already-exited fixture watcher needs no further signal. */
    }
  }
  for (const p of parents)
    if (p.exitCode === null && p.signalCode === null) p.kill('SIGKILL');
  for (const id of containers) docker(['rm', '-f', '-v', id]);
  for (const g of guards) rmSync(g.directory, { recursive: true, force: true });
  rmSync(scratch, { recursive: true, force: true });
}
console.log(
  'PASS cleanup: exact disposable containers and guard state removed; no retained OpenBao target used',
);
