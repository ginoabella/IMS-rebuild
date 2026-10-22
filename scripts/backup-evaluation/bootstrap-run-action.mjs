// Fault injection is confined to explicitly disposable candidates.
import { readFileSync } from 'node:fs';
import { ProtectedBaoClient } from '../openbao/protected-client.mjs';
const candidate = JSON.parse(readFileSync('/candidate.json'));
if (candidate.fixtureOnly !== true) throw new Error('Fixture binding refused');
const native = ProtectedBaoClient.prototype.call;
ProtectedBaoClient.prototype.call = async function (...args) {
  const result = await native.apply(this, args);
  if (
    process.argv[2] === 'install' &&
    Number.isInteger(candidate.fixtureFaultAfterWrite) &&
    args[2] === 'POST' &&
    args[0] === candidate.writes[candidate.fixtureFaultAfterWrite].path
  )
    throw new Error('Injected lost response after native commit');
  return result;
};
await import('../openbao/bootstrap-action.mjs');
