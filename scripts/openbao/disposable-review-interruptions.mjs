// Abrupt interruption simulation against disposable provider state after each write/checkpoint.
import { randomUUID } from 'node:crypto';
import { verifyRecoverySnapshot } from './recovery-snapshot.mjs';
export async function rehearseInterruptions(c) {
  const {
    api,
    required,
    remember,
    revoke,
    need,
    root,
    session,
    issuers,
    proposal,
    getSnapshot,
    self,
  } = c;
  const rows = [];
  const checkpoints = [
    'policy_created',
    'role_created',
    'grant_added',
    'ticket_issued',
    'snapshot_validated',
    'audit_validated',
    'maintenance_elevated',
    'target_1',
    'target_2',
    'target_3',
    'role_deleted',
    'policy_deleted',
  ];
  const endpointPath = 'sys/policies/acl/endpoint-restricted-issuer';
  const baseline = proposal.policies.find(
    (p) => p.name === 'endpoint-restricted-issuer',
  ).proposedPolicy;
  for (const stop of checkpoints) {
    const name = 'endpoint-maintenance-' + randomUUID();
    const pp = 'sys/policies/acl/' + name,
      rp = 'auth/token/roles/' + name,
      cp = 'auth/token/create/' + name;
    const initial =
      self + '\npath "sys/storage/raft/snapshot" { capabilities = ["read"] }';
    const request = {
      policies: [name],
      no_default_policy: true,
      ttl: '300s',
      explicit_max_ttl: '300s',
      renewable: false,
    };
    const grant = `path "${cp}" { capabilities = ["update"]\nrequired_parameters = ["policies", "no_default_policy", "ttl", "explicit_max_ttl", "renewable"]\nallowed_parameters = { "policies" = [["${name}"]] "ttl" = ["300s"] "explicit_max_ttl" = ["300s"] "no_default_policy" = [true] "renewable" = [false] } }`;
    const maintenance =
      self +
      '\n' +
      proposal.policies
        .map(
          (p) =>
            `path "sys/policy/${p.name}" { capabilities = ["read"] }\npath "sys/policies/acl/${p.name}" { capabilities = ["update"]\nrequired_parameters = ["policy"]\nallowed_parameters = { "policy" = ["${Buffer.from(p.proposedPolicy).toString('base64')}"] } }`,
        )
        .join('\n') +
      `\npath "${pp}" { capabilities = ["delete"] }\npath "${rp}" { capabilities = ["delete"] }`;
    let ticket,
      accessor,
      backup = false,
      writes = 0,
      reached;
    const stopAt = (checkpoint) => {
      reached = checkpoint;
      if (checkpoint === stop) throw new Error('injected_interruption');
    };
    try {
      await required(pp, { policy: initial }, session);
      stopAt('policy_created');
      await required(
        rp,
        {
          allowed_policies: [name],
          disallowed_policies: ['root', 'default'],
          allowed_policies_glob: [],
          disallowed_policies_glob: [],
          orphan: true,
          renewable: false,
          token_explicit_max_ttl: 300,
          token_period: 0,
          token_type: 'service',
        },
        session,
      );
      stopAt('role_created');
      await required(
        endpointPath,
        { policy: baseline + '\n' + grant },
        session,
      );
      stopAt('grant_added');
      ticket = (await required(cp, request, issuers.endpoint)).auth
        .client_token;
      accessor = (await required('auth/token/lookup-self', undefined, ticket))
        .data.accessor;
      stopAt('ticket_issued');
      const snapshot = await getSnapshot(ticket);
      verifyRecoverySnapshot(snapshot);
      stopAt('snapshot_validated');
      c.verifyAudit(snapshot);
      backup = true;
      stopAt('audit_validated');
      await required(pp, { policy: maintenance }, session);
      stopAt('maintenance_elevated');
      for (const [i, p] of proposal.policies.entries()) {
        need(backup, 'review_write_without_backup');
        await required(
          'sys/policies/acl/' + p.name,
          { policy: Buffer.from(p.proposedPolicy).toString('base64') },
          ticket,
        );
        writes++;
        stopAt('target_' + (i + 1));
      }
      await api(rp, undefined, ticket, 'DELETE');
      stopAt('role_deleted');
      await api(pp, undefined, ticket, 'DELETE');
      stopAt('policy_deleted');
    } catch (error) {
      if (error.message !== 'injected_interruption') throw error;
    }
    // Containment always removes exact grant under existing human prefix authority.
    await required(endpointPath, { policy: baseline }, session);
    const late = await api(cp, request, issuers.endpoint);
    const unexpected = remember(late);
    if (unexpected) await revoke(unexpected);
    need(late.status === 403 && !unexpected, 'review_interrupt_remint');
    if (accessor) {
      await required('auth/token/revoke-accessor', { accessor }, session);
      need(
        (await api('auth/token/lookup-accessor', { accessor }, session))
          .status === 400,
        'review_interrupt_revoke',
      );
      await revoke(ticket);
    }
    // Pre-backup failures cannot elevate for delete. Objects remain inert for a separate review.
    const before = (await api(pp, undefined, root)).status;
    rows.push({
      checkpoint: stop,
      reached,
      backupValidated: backup,
      targetWrites: writes,
      remintStatus: late.status,
      knownTicketRevoked: Boolean(accessor),
      inertPolicyAtStop: before === 200,
      preBackupElevationOccurred: false,
      fixtureJanitorOnly: before === 200,
    });
    await api(rp, undefined, root, 'DELETE');
    await api(pp, undefined, root, 'DELETE');
  }
  // Accelerated nonrenewable ticket expiry; production request remains exactly 300 seconds.
  const name = 'endpoint-maintenance-' + randomUUID();
  const pp = 'sys/policies/acl/' + name,
    rp = 'auth/token/roles/' + name,
    cp = 'auth/token/create/' + name;
  await required(
    pp,
    {
      policy:
        self + '\npath "sys/storage/raft/snapshot" { capabilities = ["read"] }',
    },
    session,
  );
  await required(
    rp,
    {
      allowed_policies: [name],
      orphan: true,
      renewable: false,
      token_explicit_max_ttl: 1,
      token_type: 'service',
    },
    session,
  );
  const request = {
    policies: [name],
    no_default_policy: true,
    ttl: '1s',
    explicit_max_ttl: '1s',
    renewable: false,
  };
  await required(
    endpointPath,
    {
      policy:
        baseline +
        `\npath "${cp}" { capabilities = ["update"]\nrequired_parameters = ["policies", "no_default_policy", "ttl", "explicit_max_ttl", "renewable"]\nallowed_parameters = { "policies" = [["${name}"]] "ttl" = ["1s"] "explicit_max_ttl" = ["1s"] "no_default_policy" = [true] "renewable" = [false] } }`,
    },
    session,
  );
  const ticket = (await required(cp, request, issuers.endpoint)).auth
    .client_token;
  const renewal = await api(
    'auth/token/renew-self',
    { increment: '300s' },
    ticket,
  );
  need(renewal.status === 403, 'review_nonrenewable_grant');
  await new Promise((resolve) => setTimeout(resolve, 1300));
  const expiry = await api('sys/storage/raft/snapshot', undefined, ticket);
  need(expiry.status === 403, 'review_expired_snapshot');
  await revoke(ticket);
  await required(endpointPath, { policy: baseline }, session);
  await api(rp, undefined, root, 'DELETE');
  await api(pp, undefined, root, 'DELETE');
  rows.push({
    checkpoint: 'accelerated_ticket_expiry',
    explicitMaximum: 1,
    elapsed300SecondTest: false,
    renewStatus: renewal.status,
    snapshotStatus: expiry.status,
  });
  return rows;
}
