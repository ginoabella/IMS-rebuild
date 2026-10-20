// Routine issuance only. Requires an already custodian-provisioned EXACT role.
import { existsSync, lstatSync, writeFileSync, unlinkSync } from 'node:fs';
import { provisioningPlan } from './provisioning-plan.mjs';
import { ProtectedBaoClient } from './protected-client.mjs';
process.umask(0o077);
const [lifecycle, principal, installation] = process.argv.slice(2);
try {
  const plan = provisioningPlan({ version: 1, installations: [installation] });
  if (process.argv.length !== 5 || !['endpoint', 'trunk'].includes(lifecycle))
    throw new Error();
  const role = plan.roles.find(
    (x) => x.name === `${lifecycle}-${principal}-${installation}`,
  );
  if (!role) throw new Error();
  const output = lstatSync('/output');
  if (!output.isDirectory() || output.mode & 0o077) throw new Error();
  const tokenFile = `/output/${principal}-${installation}.token`,
    accessorFile = `/output/${principal}-${installation}.accessor`;
  if (existsSync(tokenFile) || existsSync(accessorFile)) throw new Error();
  const issuer = new ProtectedBaoClient(
    '/custody/issuer.token',
    '/custody/ca.crt',
  );
  const identity = await issuer.required('auth/token/lookup-self');
  const policies = identity.data?.policies;
  if (
    !Array.isArray(policies) ||
    policies.length !== 1 ||
    policies[0] !== `${lifecycle}-restricted-issuer` ||
    (identity.data?.identity_policies?.length ?? 0) !== 0 ||
    (identity.data?.period ?? 0) !== 0
  )
    throw new Error();
  const result = await issuer.required(
    `auth/token/create/${role.name}`,
    role.request,
  );
  let wroteToken = false,
    wroteAccessor = false;
  try {
    // Preserve exact revocation metadata before installing the material token.
    writeFileSync(accessorFile, result.auth.accessor, {
      mode: 0o600,
      flag: 'wx',
    });
    wroteAccessor = true;
    writeFileSync(tokenFile, result.auth.client_token, {
      mode: 0o600,
      flag: 'wx',
    });
    wroteToken = true;
    const issued = new ProtectedBaoClient(tokenFile, '/custody/ca.crt');
    const actual = (await issued.required('auth/token/lookup-self')).data;
    if (
      actual.policies?.length !== 1 ||
      actual.policies[0] !== role.configuration.allowed_policies[0] ||
      (actual.identity_policies?.length ?? 0) !== 0 ||
      (actual.period ?? 0) !== 0 ||
      actual.orphan !== true ||
      actual.renewable !== role.configuration.renewable ||
      !Number.isFinite(actual.ttl) ||
      actual.ttl <= 0 ||
      actual.ttl > Math.min(3600, role.configuration.token_explicit_max_ttl) ||
      actual.explicit_max_ttl !== role.configuration.token_explicit_max_ttl
    )
      throw new Error();
  } catch {
    // Revoke the known response token even if neither file could be persisted.
    // On uncertain revocation retain any protected files for reconciliation.
    await issuer.revokeIssued(result.auth?.client_token);
    if (wroteToken) unlinkSync(tokenFile);
    if (wroteAccessor) unlinkSync(accessorFile);
    throw new Error();
  }
  console.log(
    JSON.stringify({
      entrypoint: 'deployment',
      state: 'issued',
      lifecycle,
      principal,
      installation,
    }),
  );
} catch {
  console.error(
    JSON.stringify({
      entrypoint: 'deployment',
      state: 'failed',
      failureCode: 'restricted_issuance_incomplete',
    }),
  );
  process.exitCode = 1;
}
