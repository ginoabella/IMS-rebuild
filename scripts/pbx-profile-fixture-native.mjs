// Fault instrumentation is mounted ONLY in the disposable clone, never production.
import { createRequire } from 'node:module';
import { readFileSync, existsSync, renameSync, appendFileSync } from 'node:fs';
const load = createRequire('/workspace/services/backend/package.json');
const base = './dist/modules/telephony/adapters/live/';
const config = JSON.parse(
  readFileSync('/run/pbx-live-native/configuration.json', 'utf8'),
);
if (
  !/^\/myims_session_[a-f0-9]{12}$/.test(new URL(config.databaseUrl).pathname)
)
  throw new Error('Isolated fault boundary required');
const root = '/var/lib/myims-pbx/control/' + config.nodeId;
function selected(kind, id) {
  appendFileSync(
    root + '/fixture-selections.jsonl',
    JSON.stringify({ kind, id }) + '\n',
    { mode: 0o600 },
  );
}
function trigger(point, id) {
  const path = root + '/fixture-fault.json';
  if (!existsSync(path)) return false;
  const fault = JSON.parse(readFileSync(path, 'utf8'));
  if (fault.point !== point || fault.operationId !== id) return false;
  renameSync(path, root + '/fixture-fault-consumed.json');
  if (fault.kind === 'sql_failure')
    throw new Error('Labelled isolated SQL acknowledgement fault');
  if (fault.kind === 'container_exit') {
    // The host kills namespace PID 1 after this exact boundary is paused.
    process.kill(process.pid, 'SIGSTOP');
    return true;
  }
  process.kill(process.pid, 'SIGKILL');
  return true;
}
const { ProtectedStaticProfiles } = load(base + 'static-profiles.js');
const selectStatic = ProtectedStaticProfiles.prototype.select;
ProtectedStaticProfiles.prototype.select = function (digest, id) {
  trigger('static_before', id);
  const result = selectStatic.call(this, digest, id);
  selected('static', id);
  trigger('static_after', id);
  return result;
};
const { NativePbxDriver } = load(base + 'native-driver.js');
const selectManaged = NativePbxDriver.prototype.select;
NativePbxDriver.prototype.select = function (identity) {
  trigger('managed_before', identity.revisionId);
  const result = selectManaged.call(this, identity);
  selected('managed', identity.revisionId);
  trigger('managed_after', identity.revisionId);
  return result;
};
const { NativeProfileTransitions } = load(base + 'profile-transition.js');
const prepare = NativeProfileTransitions.prototype.prepare;
NativeProfileTransitions.prototype.prepare = async function (
  token,
  row,
  guard,
) {
  trigger('preparation_before', row.id);
  const result = await prepare.call(this, token, row, guard);
  trigger('preparation_after', row.id);
  return result;
};
const prove = NativeProfileTransitions.prototype.prove;
NativeProfileTransitions.prototype.prove = async function (id, guard) {
  const result = await prove.call(this, id, guard);
  trigger('native_proof_after', id);
  return result;
};
const { PhysicalMutationBoundary } = load(base + 'mutation-boundary.js');
const profile = PhysicalMutationBoundary.prototype.profile;
PhysicalMutationBoundary.prototype.profile = function (
  token,
  source,
  target,
  action,
  ancestors,
) {
  return profile.call(
    this,
    token,
    source,
    target,
    (guard, ack) =>
      action(guard, async (id) => {
        await ack(id);
        trigger('native_ack_after', id);
      }),
    ancestors,
  );
};
const { AuditRepository } = load(
  './dist/modules/audit/adapters/db/audit-repository.js',
);
const watched = new WeakMap();
const append = AuditRepository.prototype.append;
AuditRepository.prototype.append = async function (tx, contract, data) {
  if (
    contract.type === 'telephony.profile.transition' &&
    ['verified', 'rolled_back'].includes(data.action)
  ) {
    trigger('sql_ack_before', data.operationId);
    watched.set(tx, data.operationId);
  }
  return append.call(this, tx, contract, data);
};
const { Transaction } = load('./dist/infrastructure/database/transaction.js');
const run = Transaction.run;
Transaction.run = async function (pool, context, operation, logger, action) {
  let id;
  const result = await run.call(
    this,
    pool,
    context,
    operation,
    logger,
    async (tx) => {
      const value = await action(tx);
      id = watched.get(tx);
      return value;
    },
  );
  if (id) trigger('sql_ack_after', id);
  return result;
};
await import('/workspace/services/backend/dist/entrypoints/telephony/native-main.js');
