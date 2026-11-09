// Trusted deployment data access. Never imported by HTTP, Next or workers.
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const load = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
export const uuid = (value) =>
  typeof value === 'string' &&
  /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
const canonical = (value) =>
  Array.isArray(value)
    ? '[' + value.map(canonical).join(',') + ']'
    : value && typeof value === 'object'
      ? '{' +
        Object.keys(value)
          .sort()
          .map((k) => JSON.stringify(k) + ':' + canonical(value[k]))
          .join(',') +
        '}'
      : JSON.stringify(value);
export const fingerprint = (value) =>
  createHash('sha256').update(canonical(value)).digest('hex');
export function stepId(request, step) {
  const h = fingerprint([request, step]);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
export function manifest(input) {
  const keys = [
    'version',
    'requestId',
    'nodeId',
    'installationId',
    'operatorId',
    'authenticationVersion',
    'expectedNodeVersion',
    'expectedCapabilityRevision',
    'expectedArtifactId',
    'expectedProfileDigest',
    'tenants',
    'unallocatedNumber',
  ];
  if (
    !input ||
    typeof input !== 'object' ||
    Object.keys(input).sort().join() !== keys.sort().join() ||
    input.version !== 1 ||
    [
      'requestId',
      'nodeId',
      'installationId',
      'operatorId',
      'expectedArtifactId',
    ].some((k) => !uuid(input[k])) ||
    !/^[a-f0-9]{64}$/.test(input.expectedProfileDigest) ||
    [
      'authenticationVersion',
      'expectedNodeVersion',
      'expectedCapabilityRevision',
    ].some((k) => !Number.isSafeInteger(input[k]) || input[k] < 1) ||
    !Array.isArray(input.tenants) ||
    input.tenants.length !== 2 ||
    !/^[0-9]{4,8}$/.test(input.unallocatedNumber)
  )
    throw new Error('Invalid preparation manifest');
  for (const t of input.tenants) {
    if (
      !t ||
      Object.keys(t).sort().join() !==
        [
          'tenantCode',
          'displayName',
          'extensionNumber',
          'inboundNumber',
          'outboundNumber',
        ]
          .sort()
          .join() ||
      !/^p4-dev-[ab]$/.test(t.tenantCode) ||
      !/^P4 controlled development [AB]$/.test(t.displayName) ||
      ['extensionNumber', 'inboundNumber', 'outboundNumber'].some(
        (k) => typeof t[k] !== 'string' || !/^[0-9]{4,8}$/.test(t[k]),
      )
    )
      throw new Error('Invalid dedicated tenant definition');
  }
  if (
    new Set(input.tenants.map((t) => t.tenantCode)).size !== 2 ||
    new Set([
      ...input.tenants.map((t) => t.extensionNumber),
      input.unallocatedNumber,
    ]).size !== 3 ||
    new Set(input.tenants.flatMap((t) => [t.inboundNumber, t.outboundNumber]))
      .size !== 4
  )
    throw new Error('Conflicting preparation numbers');
  return input;
}
export class PreparationStore {
  constructor(client, input) {
    this.client = client;
    this.input = manifest(input);
  }
  async existing() {
    return (
      (
        await this.client.query(
          'SELECT * FROM public.tenant_call_preparations WHERE id=$1',
          [this.input.requestId],
        )
      ).rows[0] ?? null
    );
  }
  async verifyExisting() {
    const row = await this.existing();
    if (row && row.fingerprint !== fingerprint(this.input))
      throw new Error('Preparation request conflict');
    return row;
  }
  async locked(action) {
    await this.client.query('SELECT pg_advisory_lock(hashtextextended($1,0))', [
      'controlled-preparation:' + this.input.requestId,
    ]);
    try {
      return await action();
    } finally {
      await this.client.query(
        'SELECT pg_advisory_unlock(hashtextextended($1,0))',
        ['controlled-preparation:' + this.input.requestId],
      );
    }
  }
  async transaction(action, readOnly = false) {
    if (readOnly) {
      await this.client.query(
        'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY',
      );
      try {
        const result = await action();
        await this.client.query('COMMIT');
        return result;
      } catch (error) {
        await this.client.query('ROLLBACK');
        throw error;
      }
    }
    const { Transaction } = load(
      './dist/infrastructure/database/transaction.js',
    );
    const { SafeLogger } = load('./dist/infrastructure/execution/logging.js');
    const p = this.input;
    return Transaction.runWithClient(
      this.client,
      {
        actor: {
          kind: 'platform_operator',
          plane: 'platform',
          reference: p.operatorId,
          tenantId: null,
        },
        target: {
          type: 'controlled-preparation',
          reference: p.requestId,
          tenantId: null,
        },
        correlationId: p.requestId,
      },
      'telephony.controlled-preparation',
      new SafeLogger('deployment', () => {}),
      async (tx) => {
        this.tx = tx;
        try {
          await this.authority();
          return await action();
        } finally {
          this.tx = null;
        }
      },
    );
  }
  async audit(action) {
    const { AuditRepository } = load(
      './dist/modules/audit/adapters/db/audit-repository.js',
    );
    await new AuditRepository().append(
      this.tx,
      {
        type: 'telephony.controlled-preparation',
        version: 1,
        fields: {
          preparationId: { kind: 'uuid' },
          action: {
            kind: 'enum',
            values: ['prepare', 'step', 'start', 'stop', 'disable'],
          },
        },
      },
      { preparationId: this.input.requestId, action },
    );
  }
  async authority() {
    const p = this.input;
    const { platformAuthorityIn } = load(
      './dist/modules/platform/adapters/db/authority-read.js',
    );
    const found = await platformAuthorityIn(
      this.tx ?? this.client,
      p.operatorId,
      !!this.tx,
    );
    if (
      found.kind !== 'eligible' ||
      found.snapshot.authenticationVersion !== p.authenticationVersion
    )
      throw new Error('Preparation owner unavailable');
  }
  async assertTarget() {
    const p = this.input;
    const found = (
      await this.client.query(
        `SELECT n.version,c.revision,c.kinds,c.signaling,c.codecs,c.media,c.credential_auth_max,c.credential_hex_max,r.verified_id,r.installed_id,r.runtime_state,r.active_operation_id,r.active_retirement_id,r.active_profile_operation_id,a.digest FROM public.pbx_nodes n JOIN public.endpoint_capabilities c ON c.installation_id=n.installation_id JOIN public.pbx_live_runtime r ON r.node_id=n.id JOIN public.pbx_artifact_profiles a ON a.artifact_id=r.verified_id WHERE n.id=$1 AND n.installation_id=$2`,
        [p.nodeId, p.installationId],
      )
    ).rows[0];
    if (
      !found ||
      found.version !== p.expectedNodeVersion ||
      found.revision !== p.expectedCapabilityRevision ||
      !found.kinds.includes('sip') ||
      !found.signaling.includes('udp') ||
      !found.codecs.includes('ulaw') ||
      !found.media.includes('none') ||
      found.credential_auth_max < 71 ||
      found.credential_hex_max < 64 ||
      found.credential_auth_max === null ||
      found.credential_hex_max === null ||
      found.verified_id !== p.expectedArtifactId ||
      found.installed_id !== p.expectedArtifactId ||
      found.digest !== p.expectedProfileDigest ||
      found.runtime_state !== 'verified' ||
      found.active_operation_id ||
      found.active_retirement_id ||
      found.active_profile_operation_id
    )
      throw new Error('Preparation target stale or incompatible');
  }
  async preview() {
    const p = this.input;
    return this.transaction(async () => {
      await this.authority();
      const previous = await this.verifyExisting();
      if (
        previous &&
        (
          await this.client.query(
            "SELECT 1 FROM public.tenant_call_preparation_steps WHERE preparation_id=$1 AND step='cases' AND phase='outcome'",
            [p.requestId],
          )
        ).rows.length
      )
        return { state: 'retained', requestId: p.requestId };
      await this.assertTarget();
      if (previous) return { state: 'retained', requestId: p.requestId };
      const numbers = [
        ...p.tenants.map((t) => t.extensionNumber),
        p.unallocatedNumber,
      ];
      const collision = await this.client.query(
        `SELECT 1 FROM public.telephony_number_claims c,unnest($2::text[]) candidate WHERE c.installation_id=$1 AND c.digit_length=length(candidate) AND c.span @> candidate::bigint LIMIT 1`,
        [p.installationId, numbers],
      );
      const codes = await this.client.query(
        'SELECT 1 FROM public.tenants WHERE normalized_code=ANY($1::text[]) LIMIT 1',
        [p.tenants.map((t) => t.tenantCode)],
      );
      const sources = await this.client.query(
        "SELECT 1 FROM public.sip_gateway_sources WHERE installation_id=$1 AND removed_at IS NULL AND address IN ('127.0.0.2'::inet,'127.0.0.3'::inet,'127.0.0.4'::inet) LIMIT 1",
        [p.installationId],
      );
      const peers = await this.client.query(
        "SELECT 1 FROM public.sip_trunks WHERE installation_id=$1 AND removed_at IS NULL AND (name='P4 controlled sink' OR (settings->>'host'='127.0.0.4' AND (settings->>'port')::integer IN (20020,20021))) UNION ALL SELECT 1 FROM public.sip_gateways WHERE installation_id=$1 AND removed_at IS NULL AND name='P4 controlled ingress' LIMIT 1",
        [p.installationId],
      );
      if (sources.rows.length) throw new Error('Controlled source conflict');
      if (collision.rows.length || codes.rows.length || peers.rows.length)
        throw new Error('Dedicated resource or sink conflict');
      return {
        state: 'preview',
        requestId: p.requestId,
        resourceEffects: false,
        calls: 0,
      };
    }, true);
  }
  async accept() {
    await this.preview();
    return this.transaction(async () => {
      await this.authority();
      await this.client.query(
        'SELECT id FROM public.pbx_nodes WHERE id=$1 FOR UPDATE',
        [this.input.nodeId],
      );
      const row = await this.verifyExisting();
      if (!row) {
        await this.assertTarget();
        await this.client.query(
          'INSERT INTO public.tenant_call_preparations(id,node_id,installation_id,operator_id,authentication_version,fingerprint,definition) VALUES($1,$2,$3,$4,$5,$6,$7)',
          [
            this.input.requestId,
            this.input.nodeId,
            this.input.installationId,
            this.input.operatorId,
            this.input.authenticationVersion,
            fingerprint(this.input),
            this.input,
          ],
        );
        await this.audit('prepare');
      }
      return { requestId: this.input.requestId, replayed: !!row };
    });
  }
  async step(name, input, action) {
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(name))
      throw new Error('Invalid preparation step');
    const rows = (
      await this.client.query(
        'SELECT phase,result FROM public.tenant_call_preparation_steps WHERE preparation_id=$1 AND step=$2',
        [this.input.requestId, name],
      )
    ).rows;
    const intent = rows.find((r) => r.phase === 'intent');
    if (intent && fingerprint(intent.result) !== fingerprint(input))
      throw new Error('Preparation step conflict');
    const outcome = rows.find((r) => r.phase === 'outcome');
    if (outcome) return outcome.result;
    if (!intent)
      await this.transaction(async () => {
        await this.client.query(
          "INSERT INTO public.tenant_call_preparation_steps(preparation_id,step,phase,result) VALUES($1,$2,'intent',$3)",
          [this.input.requestId, name, input],
        );
        await this.audit('step');
      });
    // Only callers with canonical exact-retry/reconciliation contracts may run.
    const result = await action(input);
    await this.transaction(async () => {
      if (name === 'cases')
        await this.client.query(
          'SELECT id FROM public.pbx_nodes WHERE id=$1 FOR UPDATE',
          [this.input.nodeId],
        );
      await this.client.query(
        "INSERT INTO public.tenant_call_preparation_steps(preparation_id,step,phase,result) VALUES($1,$2,'outcome',$3)",
        [this.input.requestId, name, result],
      );
      if (name === 'cases')
        await this.client.query(
          'UPDATE public.tenant_call_custody_proofs SET valid=false WHERE node_id=$1',
          [this.input.nodeId],
        );
      await this.audit('step');
    });
    return result;
  }
  async lifecycle(action, requestId, expectedVersion) {
    if (
      !['start', 'stop', 'disable'].includes(action) ||
      !uuid(requestId) ||
      !Number.isSafeInteger(expectedVersion) ||
      expectedVersion < 0
    )
      throw new Error('Invalid lifecycle request');
    return this.transaction(async () => {
      await this.authority();
      await this.verifyExisting();
      await this.client.query(
        'SELECT id FROM public.pbx_nodes WHERE id=$1 FOR UPDATE',
        [this.input.nodeId],
      );
      const prior = (
        await this.client.query(
          'SELECT * FROM public.tenant_call_preparation_events WHERE request_id=$1',
          [requestId],
        )
      ).rows[0];
      if (prior) {
        if (
          prior.preparation_id !== this.input.requestId ||
          prior.action !== action ||
          prior.version !== expectedVersion + 1
        )
          throw new Error('Lifecycle request conflict');
        return prior;
      }
      const latest = (
        await this.client.query(
          'SELECT * FROM public.tenant_call_preparation_events WHERE preparation_id=$1 ORDER BY version DESC LIMIT 1',
          [this.input.requestId],
        )
      ).rows[0];
      if (
        (latest?.version ?? 0) !== expectedVersion ||
        latest?.action === 'disable'
      )
        throw new Error('Lifecycle version conflict or disabled preparation');
      const owner = (
        await this.client.query(
          'SELECT epoch,expires_at>clock_timestamp() AS current FROM public.pbx_ownership WHERE node_id=$1',
          [this.input.nodeId],
        )
      ).rows[0];
      if (!owner) throw new Error('Native owner unavailable');
      const participant = (
        await this.client.query(
          'SELECT instance_id FROM public.tenant_call_participant_instances WHERE node_id=$1',
          [this.input.nodeId],
        )
      ).rows[0];
      if (action === 'start') {
        const ready = await this.client.query(
          "SELECT 1 FROM public.tenant_call_preparation_steps WHERE preparation_id=$1 AND step='cases' AND phase='outcome'",
          [this.input.requestId],
        );
        const work = await this.client.query(
          "SELECT 1 FROM public.tenant_route_test_progress WHERE node_id=$1 AND state IN ('queued','dispatching','admitted','unknown')",
          [this.input.nodeId],
        );
        if (
          !owner.current ||
          !participant ||
          !ready.rows.length ||
          work.rows.length
        )
          throw new Error('Start blocked: setup, owner or unresolved work');
      }
      const event = (
        await this.client.query(
          'INSERT INTO public.tenant_call_preparation_events(request_id,preparation_id,version,action,owner_epoch,participant_instance) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
          [
            requestId,
            this.input.requestId,
            expectedVersion + 1,
            action,
            owner.epoch,
            participant?.instance_id ?? null,
          ],
        )
      ).rows[0];
      if (action === 'start') {
        const unavailable = await this.client.query(
          'SELECT 1 FROM public.tenant_call_preparation_cases c WHERE c.preparation_id=$1 AND NOT public.tenant_case_preparation_available(c.case_id) LIMIT 1',
          [this.input.requestId],
        );
        if (unavailable.rows.length)
          throw new Error(
            'Start blocked: exact custody, participant or resource facts unavailable',
          );
      }
      if (action === 'disable')
        await this.client.query(
          'INSERT INTO public.tenant_route_case_disables(case_id,request_id,preparation_id) SELECT case_id,$2,preparation_id FROM public.tenant_call_preparation_cases WHERE preparation_id=$1 ON CONFLICT DO NOTHING',
          [this.input.requestId, requestId],
        );
      await this.audit(action);
      return event;
    });
  }
  status() {
    return this.transaction(() => this.readStatus(), true);
  }
  async readStatus() {
    const row = await this.verifyExisting();
    if (!row) return { state: 'not_prepared', requestId: this.input.requestId };
    const steps = (
      await this.client.query(
        'SELECT step,phase,created_at,result FROM public.tenant_call_preparation_steps WHERE preparation_id=$1 ORDER BY created_at,step,phase LIMIT 129',
        [row.id],
      )
    ).rows;
    if (steps.length > 128) throw new Error('Preparation inventory limit');
    const custody =
      (
        await this.client.query(
          `SELECT o.epoch::text AS owner_epoch,participant.instance_id,(f.valid AND f.owner_epoch=o.epoch AND f.source_digest=v.source_digest AND f.checked_at>statement_timestamp()-interval '15 seconds' AND o.expires_at>statement_timestamp()) IS TRUE AS current FROM public.pbx_ownership o LEFT JOIN public.tenant_call_custody_proofs f ON f.node_id=o.node_id LEFT JOIN public.tenant_call_participant_instances participant ON participant.node_id=o.node_id LEFT JOIN public.pbx_live_runtime r ON r.node_id=o.node_id LEFT JOIN public.pbx_live_artifacts a ON a.id=r.verified_id LEFT JOIN public.pbx_revisions v ON v.id=a.revision_id WHERE o.node_id=$1`,
          [this.input.nodeId],
        )
      ).rows[0] ?? null;
    const inventory =
      steps.find((s) => s.step === 'cases' && s.phase === 'outcome')?.result
        .resources ?? null;
    const safeSteps = steps.map((s) => ({
      step: s.step,
      phase: s.phase,
      createdAt: s.created_at,
      resourceIds: [
        s.result.id,
        s.result.extension?.id,
        s.result.profile?.id,
        s.result.tenant?.id,
        s.result.current?.tenant?.id,
        s.result.resource?.id,
        s.result.operationId,
        ...(Array.isArray(s.result.items)
          ? s.result.items.map((item) => item.id)
          : []),
      ].filter(uuid),
    }));
    const event =
      (
        await this.client.query(
          'SELECT request_id,version,action,owner_epoch,participant_instance,created_at FROM public.tenant_call_preparation_events WHERE preparation_id=$1 ORDER BY version DESC LIMIT 1',
          [row.id],
        )
      ).rows[0] ?? null;
    const cases = (
      await this.client.query(
        'SELECT c.case_id,public.tenant_case_preparation_available(c.case_id) AS available FROM public.tenant_call_preparation_cases c WHERE c.preparation_id=$1 ORDER BY c.case_id',
        [row.id],
      )
    ).rows;
    const blockers = [];
    if (!steps.some((s) => s.step === 'cases' && s.phase === 'outcome'))
      blockers.push('setup_incomplete');
    if (event?.action !== 'start')
      blockers.push(
        event?.action === 'disable'
          ? 'preparation_disabled'
          : 'participants_stopped',
      );
    if (event && String(event.owner_epoch) !== custody?.owner_epoch)
      blockers.push('owner_changed');
    if (
      event?.action === 'start' &&
      event.participant_instance !== custody?.instance_id
    )
      blockers.push('native_restarted');
    if (!custody?.current)
      blockers.push('protected_custody_unavailable_or_stale');
    if (cases.some((c) => !c.available) && !blockers.length)
      blockers.push('resource_versions_or_authority_stale');
    if (
      (
        await this.client.query(
          "SELECT 1 FROM public.tenant_route_test_progress WHERE node_id=$1 AND state IN ('queued','dispatching','admitted','unknown') LIMIT 1",
          [this.input.nodeId],
        )
      ).rows.length
    )
      blockers.push('controlled_work_pending_or_unknown');
    return {
      requestId: row.id,
      state: steps.some((s) => s.step === 'cases' && s.phase === 'outcome')
        ? 'prepared'
        : 'incomplete',
      event,
      steps: safeSteps,
      inventory,
      custody,
      blockers,
      cases,
      readiness: 'separate_current_runtime_and_call_evidence_required',
    };
  }
}
