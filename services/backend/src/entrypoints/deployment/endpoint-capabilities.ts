import { readFileSync, statSync } from 'node:fs';
import { Client } from 'pg';
import { loadMigrationConfig } from '../../infrastructure/configuration';
import { id, object, version } from '../../modules/telephony/domain/inventory';
/** Trusted deployment command. Exact reviewed JSON file, no HTTP/configuration import. */
export async function declareEndpointCapabilities(args: string[]) {
  if (args.length !== 1 || !args[0])
    throw new Error('One reviewed capability file required');
  const stat = statSync(args[0]);
  if (!stat.isFile() || stat.size > 32768)
    throw new Error('Capability declaration too large');
  const bytes = readFileSync(args[0]);
  if (bytes.length > 32768) throw new Error('Capability declaration too large');
  const parsed: unknown = JSON.parse(bytes.toString('utf8'));
  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 64)
    throw new Error('Invalid capability declarations');
  const seen = new Set<string>();
  const declarations = parsed.map((value) => {
    const data = object(value, [
      'installationId',
      'revision',
      'kinds',
      'signaling',
      'codecs',
      'media',
    ]);
    const installationId = id(data.installationId, 'nodeId'),
      revision = version(data.revision);
    if (seen.has(installationId))
      throw new Error('Duplicate capability installation');
    seen.add(installationId);
    const choices = (key: string, allowed: string[]) => {
      const values = data[key];
      if (
        !Array.isArray(values) ||
        !values.length ||
        values.length > allowed.length ||
        new Set(values).size !== values.length ||
        values.some((v) => typeof v !== 'string' || !allowed.includes(v))
      )
        throw new Error('Invalid capability choice');
      return values as string[];
    };
    return {
      installationId,
      revision,
      kinds: choices('kinds', ['sip', 'webrtc']),
      signaling: choices('signaling', ['udp', 'wss']),
      codecs: choices('codecs', ['opus', 'ulaw', 'alaw']),
      media: choices('media', ['none', 'dtls-srtp']),
    };
  });
  const client = new Client({
    connectionString: loadMigrationConfig().adminUrl,
    connectionTimeoutMillis: 2000,
    statement_timeout: 5000,
  });
  try {
    await client.connect();
    await client.query('BEGIN');
    for (const d of declarations.sort((a, b) =>
      a.installationId.localeCompare(b.installationId),
    )) {
      // Identical deployment replay is harmless; any changed declaration must advance revision.
      const old = (
        await client.query(
          'SELECT * FROM public.endpoint_capabilities WHERE installation_id=$1 FOR UPDATE',
          [d.installationId],
        )
      ).rows[0];
      if (
        old &&
        old.revision === d.revision &&
        JSON.stringify([old.kinds, old.signaling, old.codecs, old.media]) ===
          JSON.stringify([d.kinds, d.signaling, d.codecs, d.media])
      )
        continue;
      await client.query(
        'INSERT INTO public.endpoint_capabilities(installation_id,revision,kinds,signaling,codecs,media) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(installation_id) DO UPDATE SET revision=EXCLUDED.revision,kinds=EXCLUDED.kinds,signaling=EXCLUDED.signaling,codecs=EXCLUDED.codecs,media=EXCLUDED.media',
        [d.installationId, d.revision, d.kinds, d.signaling, d.codecs, d.media],
      );
    }
    await client.query('COMMIT');
    console.log(
      JSON.stringify({
        entrypoint: 'deployment',
        capabilityDeclarations: declarations.length,
        state: 'complete',
      }),
    );
  } catch {
    await client.query('ROLLBACK').catch(() => {});
    throw new Error('Capability deployment failed');
  } finally {
    await client.end();
  }
}
