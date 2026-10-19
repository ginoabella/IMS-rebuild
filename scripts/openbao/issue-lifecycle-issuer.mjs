// Explicit human maintenance only: replacement through fixed issuer roles.
import {
  readFileSync,
  lstatSync,
  existsSync,
  writeFileSync,
  unlinkSync,
} from 'node:fs';
import { provisioningPlan } from './provisioning-plan.mjs';
import { provisioningPreflight } from './provisioning-preflight.mjs';
import { custodianSuccessionPlan } from './custodian-succession-plan.mjs';
import { ProtectedBaoClient } from './protected-client.mjs';
process.umask(0o077);
let stage = 'custody';
try {
  const [lifecycle, manifestFile] = process.argv.slice(2);
  if (
    process.argv.length !== 4 ||
    !['endpoint', 'trunk'].includes(lifecycle) ||
    !manifestFile
  )
    throw new Error();
  const out = lstatSync('/output');
  if (!out.isDirectory() || out.isSymbolicLink() || out.mode & 0o077)
    throw new Error();
  const tokenFile = `/output/${lifecycle}-issuer.token`,
    accessorFile = `/output/${lifecycle}-issuer.accessor`;
  if (
    existsSync(tokenFile) ||
    existsSync(accessorFile) ||
    lstatSync(manifestFile).size > 8192
  )
    throw new Error();
  const plan = provisioningPlan(JSON.parse(readFileSync(manifestFile, 'utf8')));
  const provider = new ProtectedBaoClient(
    '/session/custodian.token',
    '/trust/ca.crt',
  );
  stage = 'human_identity';
  const identity = await provider.required('auth/token/lookup-self');
  const d = identity.data;
  if (
    JSON.stringify(d?.policies) !==
      JSON.stringify(['platform-deployment-maintainer']) ||
    (d.identity_policies?.length ?? 0) !== 0 ||
    d.orphan !== true ||
    d.explicit_max_ttl !== 900 ||
    !Number.isInteger(d.ttl) ||
    d.ttl < 1 ||
    d.ttl > 900 ||
    d.period
  )
    throw new Error();
  const role = custodianSuccessionPlan(
    'platform-owner-custodian',
  ).issuerRoles.find((r) => r.name === `platform-${lifecycle}-issuer`);
  stage = 'read_only_preflight';
  const checked = await provisioningPreflight(provider, {
    mount: plan.mount,
    policies: plan.policies,
    roles: [...plan.roles, role],
  });
  if (
    checked.createMount ||
    checked.missingPolicies.length ||
    checked.missingRoles.length
  )
    throw new Error();
  stage = 'fixed_role_issue';
  const issued = await provider.required(
    `auth/token/create/${role.name}`,
    role.request,
  );
  const token = issued.auth?.client_token,
    accessor = issued.auth?.accessor;
  if (typeof token !== 'string' || typeof accessor !== 'string')
    throw new Error();
  let wroteAccessor = false,
    wroteToken = false;
  try {
    // Record known exact revocation metadata before additional I/O.
    writeFileSync(accessorFile, accessor, { mode: 0o600, flag: 'wx' });
    wroteAccessor = true;
    writeFileSync(tokenFile, token, { mode: 0o600, flag: 'wx' });
    wroteToken = true;
    const result = await provider.call(
      'auth/token/lookup-self',
      undefined,
      'GET',
      token,
    );
    const child = result.value.data;
    if (
      result.status !== 200 ||
      JSON.stringify(child?.policies) !==
        JSON.stringify([`${lifecycle}-restricted-issuer`]) ||
      (child.identity_policies?.length ?? 0) !== 0 ||
      child.orphan !== true ||
      child.renewable !== false ||
      !Number.isInteger(child.ttl) ||
      child.ttl < 1 ||
      child.ttl > 86400 ||
      child.explicit_max_ttl !== 86400 ||
      child.period
    )
      throw new Error();
  } catch {
    // No generic issuance, broad revocation or deletion of another writer's files.
    await provider.revokeIssued(token);
    if (
      (await provider.call('auth/token/lookup-self', undefined, 'GET', token))
        .status !== 403
    )
      throw new Error();
    if (wroteToken) unlinkSync(tokenFile);
    if (wroteAccessor) unlinkSync(accessorFile);
    throw new Error();
  }
  console.log(
    JSON.stringify({
      entrypoint: 'deployment',
      state: 'restricted_issuer_staged',
      lifecycle,
      maximumSeconds: 86400,
      installation:
        'separate_validated_swap_and_prior_accessor_revocation_required',
    }),
  );
} catch {
  console.error(
    JSON.stringify({
      entrypoint: 'deployment',
      state: 'failed',
      stage,
      failureCode: 'issuer_replacement_incomplete_review_required',
    }),
  );
  process.exitCode = 1;
}
