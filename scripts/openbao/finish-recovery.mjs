// MANUAL ONLY: close the SAME separately confirmed isolated recovery operation.
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { protectedFile, ProtectedBaoClient } from './protected-client.mjs';
process.umask(0o077);
let stage = 'operation';
try {
  const [operationId] = process.argv.slice(2);
  if (
    process.argv.length !== 3 ||
    !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(operationId ?? '')
  )
    throw new Error();
  const operation = JSON.parse(
    protectedFile('/recovery/recovery-started.json').toString('utf8'),
  );
  if (
    operation.operationId !== operationId ||
    existsSync('/recovery/root-revoked.json')
  )
    throw new Error();
  const provider = new ProtectedBaoClient(
    '/recovery/custodian.token',
    '/seal/ca.crt',
  );
  stage = 'root_identity';
  const identity = await provider.call('auth/token/lookup-self');
  if (identity.status === 200) {
    if (
      identity.value.data?.policies?.length !== 1 ||
      identity.value.data.policies[0] !== 'root'
    )
      throw new Error();
    stage = 'attempt_cancellation';
    await provider.required('sys/generate-root/attempt', undefined, 'DELETE');
    stage = 'root_revocation';
    await provider.required('auth/token/revoke-self', {});
  } else if (identity.status !== 403) throw new Error();
  stage = 'revocation_verification';
  if ((await provider.call('auth/token/lookup-self')).status !== 403)
    throw new Error();
  stage = 'transient_cleanup';
  unlinkSync('/recovery/custodian.token');
  writeFileSync(
    '/recovery/root-revoked.json',
    JSON.stringify({ operationId, revokedAt: new Date().toISOString() }),
    { mode: 0o600, flag: 'wx' },
  );
  console.log(
    JSON.stringify({
      entrypoint: 'deployment',
      state: 'root_revoked',
      operationId,
      restoration: 'still_required',
    }),
  );
} catch {
  console.error(
    JSON.stringify({
      entrypoint: 'deployment',
      state: 'failed',
      stage,
      failureCode: 'recovery_finalization_incomplete_do_not_resume',
    }),
  );
  process.exitCode = 1;
}
