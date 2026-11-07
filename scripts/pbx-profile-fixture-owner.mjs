// Isolated counterpart of the existing telephony owner/consumer role split.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
const load = createRequire('/workspace/services/backend/package.json');
const base = './dist/modules/telephony/adapters/live/';
const { LiveExecutionStore } = load(base + 'execution-store.js');
const { NativeOwnerClient } = load(base + 'native-transport.js');
const { ObservationRepository } = load(
  './dist/modules/telephony/adapters/db/observation-repository.js',
);
const { observationSettings } = load(
  './dist/modules/telephony/domain/observation-settings.js',
);
const [database, nodeId] = process.argv.slice(2);
if (
  !/^myims_session_[a-f0-9]{12}$/.test(database ?? '') ||
  !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(nodeId ?? '')
)
  throw new Error('Isolated profile owner required');
const executor = new URL(
  'postgresql://myims_pbx_executor@postgres:5432/' + database,
);
executor.password = readFileSync('/input/executor.password', 'utf8').trim();
const runtime = new URL('postgresql://myims_runtime@postgres:5432/' + database);
runtime.password = readFileSync('/input/runtime.password', 'utf8').trim();
const ownership = new ObservationRepository(
  runtime.href,
  observationSettings(),
);
const store = new LiveExecutionStore(executor.href),
  native = new NativeOwnerClient('/run/pbx-live/native.sock');
let token,
  running = true;
const incarnation = randomUUID();
process.on('SIGTERM', () => {
  running = false;
});
try {
  while (running) {
    try {
      token = token
        ? await ownership.renew(token)
        : await ownership.acquire(nodeId, incarnation);
    } catch {
      /* Transport uncertainty retains the same owner until canonical expiry. */
    }
    if (token) {
      try {
        await native.connect(token);
        await store.heartbeat(token);
        const id = await store.next(nodeId);
        if (id) {
          const row = await store.intent(nodeId, id);
          if (row && row.kind !== 'apply')
            await native.execute(token, id, null);
        }
      } catch {
        /* No ownership replacement for a private socket outage. */
      }
    }
    await delay(500);
  }
} finally {
  if (token) await ownership.release(token);
  await ownership.close();
  await store.close();
}
