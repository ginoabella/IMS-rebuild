import { connect } from 'node:tls';
import { readFileSync, statSync } from 'node:fs';
import type {
  PbxCredentialResolver,
  PbxDestinationPolicy,
  PbxProfile,
} from '../../domain/connectivity';
import type { PbxObservationAdapter } from '../../application/observation-ports';
import type { ObservationSettings } from '../../domain/observation-settings';
import { AmiSession, AmiFailure } from './ami-session';
/** TLS/protocol/material dependencies are confined here; engine sees only the port. */
export class AmiObservationAdapter implements PbxObservationAdapter {
  private readonly ca: Buffer;
  constructor(
    private readonly credentials: PbxCredentialResolver,
    private readonly destination: PbxDestinationPolicy,
    trustFile: string,
    private readonly settings: Readonly<ObservationSettings>,
  ) {
    try {
      if (!statSync(trustFile).isFile() || statSync(trustFile).size > 65536)
        throw new Error();
      this.ca = readFileSync(trustFile);
    } catch {
      throw new Error('PBX TLS trust unavailable');
    }
  }
  async open(
    profile: Readonly<PbxProfile>,
    alias: string,
    signal: AbortSignal,
  ): ReturnType<PbxObservationAdapter['open']> {
    if (!profile.credentialAliases.includes(alias) || signal.aborted)
      return { kind: 'failed', failure: 'destination_denied' };
    const bounded = AbortSignal.any([
      signal,
      AbortSignal.timeout(this.settings.ioMs),
    ]);
    let socket: ReturnType<typeof connect> | undefined;
    const close = () => socket?.destroy();
    bounded.addEventListener('abort', close, { once: true });
    try {
      // Secret lookup is bounded even for a failed protected mount/provider.
      const secret = await Promise.race([
        this.credentials.resolve(alias),
        new Promise<never>((_, reject) =>
          bounded.addEventListener(
            'abort',
            () => reject(new AmiFailure('timeout')),
            { once: true },
          ),
        ),
      ]);
      if (secret.kind !== 'resolved')
        return { kind: 'failed', failure: secret.kind };
      const dest = await this.destination.destination(profile, signal);
      if (dest.kind !== 'approved')
        return { kind: 'failed', failure: dest.kind };
      if (signal.aborted) return { kind: 'failed', failure: 'timeout' };
      const cancelConnect = () => socket?.destroy();
      signal.addEventListener('abort', cancelConnect, { once: true });
      const connectTimer = setTimeout(cancelConnect, this.settings.ioMs);
      socket = connect({
        host: dest.address,
        port: dest.port,
        servername: dest.servername,
        ca: this.ca,
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2',
      });
      const session = new AmiSession(socket, this.settings);
      try {
        await new Promise<void>((resolve, reject) => {
          socket?.once('secureConnect', resolve);
          socket?.once('error', () => reject(new AmiFailure('connect_failed')));
          socket?.once('close', () => reject(new AmiFailure('connect_failed')));
        });
      } finally {
        clearTimeout(connectTimer);
        signal.removeEventListener('abort', cancelConnect);
      }
      bounded.removeEventListener('abort', close);
      await session.authenticate(secret.username, secret.password, signal);
      return { kind: 'connected', session };
    } catch (error) {
      socket?.destroy();
      return {
        kind: 'failed',
        failure: error instanceof AmiFailure ? error.failure : 'connect_failed',
      };
    } finally {
      bounded.removeEventListener('abort', close);
    }
  }
}
