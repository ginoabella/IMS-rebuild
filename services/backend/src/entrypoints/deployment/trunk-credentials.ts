import { Client } from 'pg';
import { loadMigrationConfig } from '../../infrastructure/configuration';
import {
  id,
  label,
  object,
  PeerRejected,
} from '../../modules/telephony/domain/peer';
import { TrunkProviderError } from '../../modules/telephony/application/trunk-credential-ports';
import { trunkImportMaterial } from '../../modules/telephony/domain/trunk-material';
import {
  protectedInput,
  SimpleTrunkProvider,
  SimpleTrunkAccessDenied,
} from '../../modules/telephony/adapters/credentials/simple-trunk-provider';
// Required material is read only from a protected file. No provider response/error
// body is logged, and no secret/hash is written to PostgreSQL or receipts.
export async function setupTrunkCredentials(args: string[]) {
  let db: Client | undefined;
  let createdIntent: string | null = null,
    writeAttempted = false;
  try {
    const [configFile, materialFile] = args;
    if (args.length !== 2 || !configFile || !materialFile)
      throw new Error(
        'Usage: trunk-credentials CONFIG_FILE MATERIAL_FILE (both owner-only).',
      );
    const c = object(JSON.parse(protectedInput(configFile).toString('utf8')), [
      'installationId',
      'credentialId',
      'label',
      'operationId',
      'expectedVersion',
      'endpoint',
      'caFile',
      'tokenFile',
    ]);
    const installation = id(c.installationId),
      credential = id(c.credentialId),
      operation = id(c.operationId),
      name = label(c.label);
    if (
      !Number.isInteger(c.expectedVersion) ||
      Number(c.expectedVersion) < 0 ||
      Number(c.expectedVersion) >= 2147483646 ||
      ['endpoint', 'caFile', 'tokenFile'].some((k) => typeof c[k] !== 'string')
    )
      throw new Error('Invalid setup configuration.');
    const expected = Number(c.expectedVersion);
    const raw = object(
      JSON.parse(protectedInput(materialFile).toString('utf8')),
      ['username', 'password', 'realm'],
    );
    const material = trunkImportMaterial(raw, String(raw.realm));
    const bao = new SimpleTrunkProvider(
      String(c.endpoint),
      String(c.caFile),
      String(c.tokenFile),
    );
    // Authentication failures precede durable import creation and are recoverable.
    const ttl = await bao.lifetime();
    const path = `myims-trunk/data/installations/${installation}/bindings/${credential}/generations/${credential}`;
    const metadataPath = path.replace('/data/', '/metadata/');
    const retained = await bao.call(metadataPath, {
      max_versions: 2147483647,
      cas_required: true,
      delete_version_after: '0s',
    });
    if (![200, 204].includes(retained.status))
      throw new Error(
        'Cannot configure retained KV versions. Setup role needs metadata update access; resume this operation after correcting it.',
      );
    const retention = await bao.call(metadataPath);
    const policy = retention.value.data as
      | {
          max_versions?: number;
          cas_required?: boolean;
          delete_version_after?: string;
        }
      | undefined;
    if (
      retention.status !== 200 ||
      policy?.max_versions !== 2147483647 ||
      policy.cas_required !== true ||
      policy.delete_version_after !== '0s'
    )
      throw new Error(
        'KV retention confirmation failed; no material write attempted.',
      );
    db = new Client({
      connectionString: loadMigrationConfig().adminUrl,
      connectionTimeoutMillis: 2000,
      statement_timeout: 10000,
    });
    db.on('error', () => {});
    await db.connect();
    // A session lock serializes this exact stable credential across provider I/O.
    await db.query('SELECT pg_advisory_lock(hashtextextended($1,0))', [
      `simple-trunk:${credential}`,
    ]);
    await db.query('BEGIN');
    const prior = (
      await db.query(
        'SELECT * FROM public.sip_credentials WHERE id=$1 FOR UPDATE',
        [credential],
      )
    ).rows[0];
    if (
      prior &&
      (prior.installation_id !== installation || prior.label !== name)
    )
      throw new Error('Credential identity/label does not match.');
    if (!prior)
      await db.query(
        'INSERT INTO public.sip_credentials(id,installation_id,label) VALUES($1,$2,$3)',
        [credential, installation, name],
      );
    const intent = (
      await db.query(
        'SELECT * FROM public.sip_credential_imports WHERE operation_id=$1',
        [operation],
      )
    ).rows[0];
    if (
      intent &&
      (intent.credential_id !== credential ||
        intent.expected_version !== expected)
    )
      throw new Error('Operation ID already identifies another import.');
    const pending = (
      await db.query(
        "SELECT operation_id FROM public.sip_credential_imports WHERE credential_id=$1 AND state='pending'",
        [credential],
      )
    ).rows[0];
    if (pending && pending.operation_id !== operation)
      throw new Error(
        `An uncertain import must be reconciled first with operation ID ${pending.operation_id}.`,
      );
    if (!intent) {
      const latest = (
        await db.query(
          'SELECT COALESCE(max(material_version),0) AS version FROM public.sip_credential_versions WHERE credential_id=$1',
          [credential],
        )
      ).rows[0];
      if (latest.version !== expected)
        throw new Error(
          'Expected material version is stale; inspect metadata before replacement.',
        );
      await db.query(
        "INSERT INTO public.sip_credential_imports(operation_id,credential_id,expected_version,state) VALUES($1,$2,$3,'pending')",
        [operation, credential, expected],
      );
    }
    await db.query('COMMIT');
    if (!intent) createdIntent = operation;
    // Durable exact identity survives response loss or process interruption.
    let r = await bao.call(
      intent?.state === 'confirmed' ? `${path}?version=${expected + 1}` : path,
    );
    const envelope = () =>
      r.value.data as
        | {
            data?: Record<string, unknown>;
            metadata?: {
              version: number;
              destroyed: boolean;
              deletion_time: string;
            };
          }
        | undefined;
    let e = envelope();
    if (!intent || intent.state !== 'confirmed') {
      if (
        r.status === 404 ||
        (r.status === 200 && e?.metadata?.version === expected)
      ) {
        // A retry first reads this exact path; CAS prevents overwriting another writer.
        writeAttempted = true;
        const result = await bao
          .call(path, {
            options: { cas: expected },
            data: {
              installationId: installation,
              credentialId: credential,
              operationId: operation,
              purpose: 'outbound-digest',
              ...material,
            },
          })
          .catch((error: unknown) => {
            // A definite provider denial cannot have stored material. Preserve an
            // older uncertain intent, but let this new rejected import be corrected.
            if (error instanceof SimpleTrunkAccessDenied)
              writeAttempted = false;
            throw error;
          });
        if (![200, 400].includes(result.status))
          throw new Error(
            'OpenBao rejected storage; retry the same operation ID to reconcile.',
          );
        r = await bao.call(path);
        e = envelope();
      }
    }
    if (r.status === 200 && e?.metadata && e.metadata.version > expected + 1) {
      r = await bao.call(`${path}?version=${expected + 1}`);
      e = envelope();
    }
    if (
      r.status !== 200 ||
      e?.metadata?.version !== expected + 1 ||
      e.metadata.destroyed ||
      e.metadata.deletion_time ||
      !e.data ||
      e.data.operationId !== operation ||
      e.data.credentialId !== credential ||
      e.data.installationId !== installation ||
      e.data.purpose !== 'outbound-digest' ||
      e.data.username !== material.username ||
      e.data.password !== material.password ||
      e.data.realm !== material.realm
    )
      throw new Error(
        'Provider identity/version differs; pending work is retained. Reconcile the exact operation before another write.',
      );
    await db.query('BEGIN');
    await db.query(
      'INSERT INTO public.sip_credential_versions(credential_id,material_version) VALUES($1,$2) ON CONFLICT DO NOTHING',
      [credential, e.metadata.version],
    );
    await db.query(
      "UPDATE public.sip_credential_imports SET state='confirmed' WHERE operation_id=$1",
      [operation],
    );
    const availability = (
      await db.query(
        'SELECT (c.available AND v.available) AS available FROM public.sip_credentials c JOIN public.sip_credential_versions v ON v.credential_id=c.id WHERE c.id=$1 AND v.material_version=$2',
        [credential, e.metadata.version],
      )
    ).rows[0];
    await db.query('COMMIT');
    console.log(
      JSON.stringify({
        state: 'confirmed',
        available: availability.available as boolean,
        credentialId: credential,
        installationId: installation,
        label: name,
        purpose: 'outbound-digest',
        version: e.metadata.version,
        operationId: operation,
        tokenRemainingSeconds: ttl,
        expiryWarning: ttl < 600,
      }),
    );
  } catch (e) {
    if (db) {
      await db.query('ROLLBACK').catch(() => {});
      if (createdIntent && !writeAttempted)
        await db
          .query(
            "DELETE FROM public.sip_credential_imports WHERE operation_id=$1 AND state='pending'",
            [createdIntent],
          )
          .catch(() => {});
    }
    // Deliberately allow only application-owned diagnostics, never PG/provider errors.
    const safe =
      e instanceof Error &&
      !('code' in e) &&
      !('severity' in e) &&
      !(e instanceof SyntaxError) &&
      !(e instanceof TypeError);
    console.error(
      e instanceof PeerRejected
        ? 'Invalid setup identity, label or material fields. Review the protected JSON files.'
        : e instanceof TrunkProviderError
          ? 'Invalid material: use a valid username, printable password and explicit realm in the protected material file.'
          : safe
            ? e.message
            : 'Trunk setup failed; verify protected input/configuration and database access. Resume the same operation ID.',
    );
    process.exitCode = 1;
  } finally {
    if (db) await db.end().catch(() => {});
  }
}
