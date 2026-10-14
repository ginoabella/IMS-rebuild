import { Resolver } from 'node:dns/promises';
import { isIP } from 'node:net';
import type {
  ApprovedPbxCatalog,
  PbxDestinationPolicy,
  PbxProfile,
} from '../../domain/connectivity';
export type AddressResolver = (
  host: string,
  signal: AbortSignal,
) => Promise<string[]>;
export function normalizedAddress(address: string): string | null {
  const family = isIP(address);
  if (!family) return null;
  return family === 4
    ? address
    : new URL(`http://[${address}]/`).hostname.slice(1, -1);
}
function forbidden(a: string): boolean {
  if (isIP(a) === 4) {
    const n = a.split('.').map(Number),
      first = n[0] ?? 0;
    return (
      first === 0 ||
      first === 127 ||
      first >= 224 ||
      (first === 169 && n[1] === 254) ||
      a === '100.100.100.200' ||
      a === '168.63.129.16'
    );
  }
  const first = parseInt(a.split(':')[0] || '0', 16);
  return (
    a === '::' ||
    a === '::1' ||
    a.startsWith('::ffff:') ||
    a.includes('%') ||
    (first & 0xffc0) === 0xfe80 ||
    (first & 0xff00) === 0xff00
  );
}
const dnsAddresses: AddressResolver = async (host, signal) => {
  if (isIP(host)) return [host];
  const resolver = new Resolver({ timeout: 1000, tries: 1 });
  const cancel = () => resolver.cancel();
  signal.addEventListener('abort', cancel, { once: true });
  try {
    if (signal.aborted) throw new Error('Resolution cancelled');
    const results = await Promise.allSettled([
      resolver.resolve4(host),
      resolver.resolve6(host),
    ]);
    // A family with no records is known-empty. Timeout or other partial DNS
    // failure must not authorize only the family that happened to succeed.
    if (
      results.some(
        (r) =>
          r.status === 'rejected' &&
          !(
            r.reason &&
            typeof r.reason === 'object' &&
            r.reason.code === 'ENODATA'
          ),
      )
    )
      throw new Error('Resolution unavailable');
    const addresses = results.flatMap((r) =>
      r.status === 'fulfilled' ? r.value : [],
    );
    if (!addresses.length) throw new Error('Resolution unavailable');
    return addresses;
  } finally {
    signal.removeEventListener('abort', cancel);
  }
};
/** Approved addresses returned here must be used directly by the socket connector. */
export class ExactPbxDestinationPolicy implements PbxDestinationPolicy {
  private active = 0;
  constructor(
    private readonly catalog: ApprovedPbxCatalog,
    private readonly resolve: AddressResolver = dnsAddresses,
    private readonly timeoutMs = 2000,
  ) {}
  async destination(
    profile: Readonly<PbxProfile>,
    signal?: AbortSignal,
  ): ReturnType<PbxDestinationPolicy['destination']> {
    // This adapter implements the approved TLS profile. Future protocols use their
    // own code-owned adapter; neither this port nor registry hardcodes a port/host.
    const approvedProfile = this.catalog.resolve(profile.targetAlias);
    if (
      !approvedProfile ||
      profile.transport !== 'ami-tls' ||
      (
        [
          'installationId',
          'host',
          'transport',
          'port',
          'tlsServerName',
        ] as const
      ).some((key) => profile[key] !== approvedProfile[key])
    )
      return { kind: 'destination_denied' };
    if (this.active >= 4 || signal?.aborted)
      return { kind: 'resolution_unavailable' };
    this.active++;
    const controller = new AbortController();
    const cancel = () => controller.abort();
    signal?.addEventListener('abort', cancel, { once: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const cancelled = new Promise<never>((_, reject) => {
        controller.signal.addEventListener(
          'abort',
          () => reject(new Error('Resolution unavailable')),
          { once: true },
        );
        timer = setTimeout(cancel, this.timeoutMs);
      });
      const answers = await Promise.race([
        this.resolve(profile.host, controller.signal),
        cancelled,
      ]);
      if (!answers.length || answers.length > 32)
        return { kind: 'destination_denied' };
      const approved = new Set(
        approvedProfile.addresses.map(normalizedAddress),
      );
      const addresses = answers.map(normalizedAddress);
      if (addresses.some((a) => !a || forbidden(a) || !approved.has(a)))
        return { kind: 'destination_denied' };
      const address = addresses[0];
      if (!address) return { kind: 'destination_denied' };
      return {
        kind: 'approved',
        address,
        family: isIP(address) === 4 ? 4 : 6,
        port: profile.port,
        servername: profile.tlsServerName,
      };
    } catch {
      return { kind: 'resolution_unavailable' };
    } finally {
      if (timer) clearTimeout(timer);
      controller.abort();
      signal?.removeEventListener('abort', cancel);
      this.active--;
    }
  }
}
