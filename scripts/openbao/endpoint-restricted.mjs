// Invoked only after explicit custody cutover. No policy edits or unrestricted issuance.
import { existsSync, writeFileSync } from 'node:fs';
import { ProtectedBaoClient } from './protected-client.mjs';
import { provisioningPlan } from './provisioning-plan.mjs';
export async function restrictedEndpointProvision(
  command,
  installation,
  fixtureRun,
) {
  const plan = provisioningPlan({ version: 1, installations: [installation] });
  if (
    command === 'provision-fixture' &&
    !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(fixtureRun ?? '')
  )
    throw new Error('Exact fixture run required');
  const issuer = new ProtectedBaoClient(
    '/custody/issuer.token',
    '/custody/ca.crt',
  );
  const identity = (await issuer.required('auth/token/lookup-self')).data;
  if (
    identity?.policies?.length !== 1 ||
    identity.policies[0] !== 'endpoint-restricted-issuer'
  )
    throw new Error('Invalid endpoint issuer');
  const targets =
    command === 'provision-expiring'
      ? ['worker-expiring']
      : ['worker', 'cleanup'];
  for (const role of targets)
    if (existsSync(`/custody/${role}-${installation}.token`))
      throw new Error('Existing endpoint custody');
  for (const role of targets) {
    const r = plan.roles.find(
      (x) => x.name === `endpoint-${role}-${installation}`,
    );
    const value = await issuer.required(`auth/token/create/${r.name}`, {
      ...r.request,
      ...(role === 'worker-expiring'
        ? { ttl: '1s', explicit_max_ttl: '1s', renewable: false }
        : {}),
    });
    try {
      if (
        value.auth?.policies?.length !== 1 ||
        value.auth.policies[0] !== r.configuration.allowed_policies[0] ||
        value.auth.lease_duration > (role === 'worker-expiring' ? 1 : 3600)
      )
        throw new Error('Invalid endpoint grant');
      writeFileSync(
        `/custody/${role}-${installation}.token`,
        value.auth.client_token,
        { mode: 0o600, flag: 'wx' },
      );
    } catch {
      await issuer.revokeIssued(value.auth?.client_token);
      throw new Error('Endpoint issuance incomplete');
    }
  }
}
