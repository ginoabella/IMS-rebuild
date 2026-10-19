// Explicit trusted deployment acceptance only. No HTTP/worker composition or SIP.
// Requires only restricted trunk issuer custody, CA and owner-only /output tmpfs.
import { createRequire } from 'node:module';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { ProtectedBaoClient } from './protected-client.mjs';
import { provisioningPlan } from './provisioning-plan.mjs';

process.umask(0o077);
const require = createRequire('/backend/package.json');
const {
  OpenBaoTrunkProvider,
} = require('/backend/dist/modules/telephony/adapters/credentials/trunk-openbao.js');
const need = (value) => {
  if (!value) throw new Error('Provider acceptance failed');
};
let stage = 'scope';
const issued = [];
try {
  const manifest = JSON.parse(readFileSync('/manifest.json', 'utf8'));
  const plan = provisioningPlan(manifest);
  need(plan.installations.length === 2);
  const issuer = new ProtectedBaoClient(
    '/custody/issuer.token',
    '/custody/ca.crt',
  );
  const identity = (await issuer.required('auth/token/lookup-self')).data;
  need(
    JSON.stringify(identity.policies) ===
      JSON.stringify(['trunk-restricted-issuer']) &&
      identity.orphan === true &&
      identity.renewable === false &&
      identity.explicit_max_ttl === 86400,
  );
  async function grant(principal, installation) {
    const role = plan.roles.find(
      (r) => r.name === `trunk-${principal}-${installation}`,
    );
    const result = await issuer.required(
      `auth/token/create/${role.name}`,
      role.request,
    );
    need(typeof result.auth?.client_token === 'string');
    const file = `/output/${role.name}.token`;
    writeFileSync(file, result.auth.client_token, { flag: 'wx', mode: 0o600 });
    const client = new ProtectedBaoClient(file, '/custody/ca.crt');
    // Retain every known response for exact cleanup, even if validation fails.
    issued.push({ file, client });
    const self = (await client.required('auth/token/lookup-self')).data;
    need(
      JSON.stringify(self.policies) ===
        JSON.stringify(role.configuration.allowed_policies) &&
        self.orphan === true &&
        self.renewable === true &&
        self.explicit_max_ttl === 86400 &&
        self.ttl > 0 &&
        self.ttl <= 3600 &&
        !self.period &&
        !self.identity_policies?.length,
    );
    return { file, client };
  }
  const [installation, otherInstallation] = plan.installations;
  stage = 'scoped_runtime_issuance';
  const importer = await grant('importer', installation);
  const verifier = await grant('verifier', installation);
  const cleanup = await grant('cleanup', installation);
  const other = await grant('verifier', otherInstallation);
  stage = 'forbidden_policy_requests_and_lifetime_escalation';
  const role = plan.roles.find(
    (r) => r.name === `trunk-verifier-${installation}`,
  );
  for (const policies of [['root'], ['default']]) {
    const result = await issuer.call(`auth/token/create/${role.name}`, {
      ...role.request,
      policies,
    });
    if (result.value.auth?.client_token) {
      const file = `/output/unexpected-policy.token`;
      writeFileSync(file, result.value.auth.client_token, {
        flag: 'wx',
        mode: 0o600,
      });
      const client = new ProtectedBaoClient(file, '/custody/ca.crt');
      issued.push({ file, client });
    }
    need(
      [400, 403].includes(result.status) && !result.value.auth?.client_token,
    );
  }
  for (const change of [
    { no_default_policy: false },
    { ttl: '48h', explicit_max_ttl: '48h' },
    { period: '1h' },
  ]) {
    stage = `role_request_${Object.keys(change)[0]}`;
    const result = await issuer.call(`auth/token/create/${role.name}`, {
      ...role.request,
      ...change,
    });
    if ([400, 403].includes(result.status)) {
      need(!result.value.auth?.client_token);
      continue;
    }
    need(
      result.status === 200 &&
        typeof result.value.auth?.client_token === 'string',
    );
    const file = `/output/escalation-${issued.length}.token`;
    writeFileSync(file, result.value.auth.client_token, {
      flag: 'wx',
      mode: 0o600,
    });
    const client = new ProtectedBaoClient(file, '/custody/ca.crt');
    issued.push({ file, client });
    const self = (await client.required('auth/token/lookup-self')).data;
    const bounded =
      JSON.stringify(self.policies) ===
        JSON.stringify(role.configuration.allowed_policies) &&
      self.orphan === true &&
      self.explicit_max_ttl === 86400 &&
      self.ttl > 0 &&
      self.ttl <= 86400 &&
      !self.period &&
      !self.identity_policies?.length;
    // Exact owned-response revocation is approved test cleanup, never remediation
    // of existing principals. Preserve any uncertain revocation for review.
    await client.required('auth/token/revoke-self', {});
    need((await client.call('auth/token/lookup-self')).status === 403);
    unlinkSync(file);
    issued.pop();
    if (!bounded)
      writeFileSync(
        '/output/unexpected-role-attributes.json',
        JSON.stringify({
          requested: change,
          policies: self.policies,
          explicitMaxTtl: self.explicit_max_ttl,
          period: self.period ?? 0,
          orphan: self.orphan,
          ttl: self.ttl,
          identityPolicies: self.identity_policies ?? [],
          exactTestTokenRevocationVerified: true,
        }),
        { flag: 'wx', mode: 0o600 },
      );
    need(bounded);
  }
  const settings = (tokenFile, installationId = installation) => ({
    endpoint: 'https://endpoint-secrets:8200',
    caFile: '/custody/ca.crt',
    tokenFile,
    installationId,
    exactRealm: 'trunk.fixture.invalid',
  });
  const writer = new OpenBaoTrunkProvider(settings(importer.file));
  const reader = new OpenBaoTrunkProvider(settings(verifier.file));
  const binding = {
    installationId: installation,
    bindingId: randomUUID(),
    peerId: randomUUID(),
    generationId: randomUUID(),
    operationId: randomUUID(),
    generationOrdinal: 1,
    materialVersion: 1,
    purposes: ['outbound-request'],
  };
  writeFileSync('/output/fixture-identity.json', JSON.stringify(binding), {
    flag: 'wx',
    mode: 0o600,
  });
  const material = {
    username: 'u3a-private-fixture',
    password: randomBytes(48).toString('base64url'),
    realm: 'trunk.fixture.invalid',
  };
  const path = `myims-trunk/data/installations/${installation}/bindings/${binding.bindingId}/generations/${binding.generationId}`;
  stage = 'real_import_verify_and_exact_replay';
  need((await reader.verify(binding)) === 'missing');
  await writer.import(binding, material);
  need((await reader.verify(binding)) === 'verified');
  await writer.import(binding, material);
  let conflict = false;
  try {
    await writer.import(binding, {
      ...material,
      password: randomBytes(48).toString('base64url'),
    });
  } catch (error) {
    conflict = error.code === 'import_conflict';
  }
  need(conflict);
  stage = 'real_cross_installation_and_forbidden_operations';
  const metadata = path.replace('/data/', '/metadata/');
  const destroy = path.replace('/data/', '/destroy/');
  for (const [client, target, body] of [
    [other.client, path, undefined],
    [verifier.client, path, { options: { cas: 1 }, data: {} }],
    [importer.client, path, { options: { cas: 1 }, data: {} }],
    [importer.client, destroy, { versions: [1] }],
    [verifier.client, 'sys/policies/acl/trunk-restricted-issuer', undefined],
    [
      verifier.client,
      'auth/token/create',
      { policies: ['root'], no_default_policy: true },
    ],
  ]) {
    const result = await client.call(target, body);
    if (result.value.auth?.client_token)
      writeFileSync(
        '/output/unexpected-token.json',
        JSON.stringify(result.value.auth),
        { flag: 'wx', mode: 0o600 },
      );
    need(result.status === 403);
  }
  need((await cleanup.client.required(metadata)).data.current_version === 1);
  stage = 'real_bounded_renewal';
  need((await writer.renew()) <= 3600 && (await reader.renew()) <= 3600);
  stage = 'exact_owned_fixture_cleanup';
  await cleanup.client.required(destroy, { versions: [1] });
  need((await reader.verify(binding)) === 'missing');
  need(
    (await cleanup.client.required(metadata)).data.versions['1'].destroyed ===
      true,
  );
  for (const { file, client } of issued) {
    await client.required('auth/token/revoke-self', {});
    need((await client.call('auth/token/lookup-self')).status === 403);
    unlinkSync(file);
  }
  unlinkSync('/output/fixture-identity.json');
  console.log(
    JSON.stringify({
      state: 'real_trunk_provider_acceptance_passed',
      checks: [
        'scoped_issuance_and_lifetimes',
        'immutable_import_verify_replay_conflict',
        'cross_installation_and_acl_denials',
        'bounded_renewal',
        'owned_generation_destroy',
        'test_token_revocation',
      ],
      ownerDatabaseAndHttpAcceptance: 'outstanding',
      sipContact: false,
    }),
  );
} catch {
  // Revoke only this test's known issued runtime tokens. Do not change roles,
  // issuers, policies or any existing principal to make a failed check pass.
  for (const { file, client } of issued) {
    try {
      await client.required('auth/token/revoke-self', {});
      if ((await client.call('auth/token/lookup-self')).status === 403)
        unlinkSync(file);
    } catch {
      /* Keep protected helper state for exact review. */
    }
  }
  console.error(
    JSON.stringify({
      state: 'provider_acceptance_stopped_for_review',
      stage,
      knownIssuedTokens: issued.length,
    }),
  );
  process.exitCode = 1;
}
