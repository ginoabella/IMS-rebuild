import { BlockList, isIP } from 'node:net';
export interface SourceRequest {
  socket: { remoteAddress?: string };
  headers: Record<string, string | string[] | undefined>;
  rawHeaders: string[];
}
export function canonicalAddress(value: unknown): string | null {
  if (
    typeof value !== 'string' ||
    value.length > 64 ||
    value.includes('%') ||
    !isIP(value)
  )
    return null;
  if (isIP(value) === 4) return value;
  const normalized = new URL(`http://[${value}]/`).hostname.slice(1, -1);
  const mapped = /^::ffff:([a-f0-9]{1,4}):([a-f0-9]{1,4})$/.exec(normalized);
  if (mapped) {
    const number = parseInt(mapped[1]!, 16) * 65536 + parseInt(mapped[2]!, 16);
    return [24, 16, 8, 0].map((shift) => (number >>> shift) & 255).join('.');
  }
  return normalized;
}
export class TrustedSource {
  private readonly proxies = new BlockList();
  constructor(entries: readonly string[]) {
    for (const entry of entries) {
      const [address, bits] = entry.split('/');
      const normalized = canonicalAddress(address);
      if (!normalized) throw new Error('Invalid trusted proxy configuration');
      const family = isIP(normalized) === 4 ? 'ipv4' : 'ipv6';
      // Mapped CIDRs would change family/prefix semantics; reject rather than broaden trust.
      if (bits !== undefined && isIP(address!) !== isIP(normalized))
        throw new Error('Ambiguous trusted proxy subnet');
      if (bits === undefined) this.proxies.addAddress(normalized, family);
      else this.proxies.addSubnet(normalized, Number(bits), family);
    }
  }
  private trusted(address: string) {
    return this.proxies.check(address, isIP(address) === 4 ? 'ipv4' : 'ipv6');
  }
  extract(request: SourceRequest): string | null {
    const peer = canonicalAddress(request.socket.remoteAddress);
    if (!peer) return null;
    if (!this.trusted(peer)) return peer;
    const raw = request.headers['x-forwarded-for'];
    if (
      typeof raw !== 'string' ||
      raw.length > 1024 ||
      request.rawHeaders.filter(
        (v, i) => i % 2 === 0 && v.toLowerCase() === 'x-forwarded-for',
      ).length !== 1
    )
      return null;
    const chain = raw.split(',');
    if (chain.length === 0 || chain.length > 16) return null;
    const addresses = chain.map((v) => canonicalAddress(v.trim()));
    if (addresses.some((v) => v === null)) return null;
    let source = peer;
    for (let i = addresses.length - 1; i >= 0 && this.trusted(source); i--)
      source = addresses[i]!;
    // A chain containing only trusted proxies has no unambiguous client.
    return this.trusted(source) ? null : source;
  }
}
