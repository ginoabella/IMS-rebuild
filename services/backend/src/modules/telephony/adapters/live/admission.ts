import { execFile } from 'node:child_process';
import { isIP } from 'node:net';
import { canonical } from '../../domain/revision-snapshot';
export class AdmissionFailure extends Error {
  constructor(
    readonly code:
      'activity_unknown' | 'activity_deadline' | 'boundary_unavailable',
  ) {
    super('PBX admission unavailable');
  }
}
function fixed(
  executable: string,
  args: string[],
  input?: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      executable,
      args,
      { timeout: 3000, maxBuffer: 262144, encoding: 'utf8' },
      (error, stdout) =>
        error
          ? reject(new AdmissionFailure('boundary_unavailable'))
          : resolve(stdout),
    );
    child.stdin?.end(input);
  });
}
/** Native PBX-container boundary only. Its caller must retain the physical mutation lock. */
export class NativeAdmissionBarrier {
  private readonly allowed: string[];
  constructor(probeAddresses: readonly string[] = []) {
    if (
      probeAddresses.length > 4 ||
      probeAddresses.some((a) => !isIP(a) || a.includes('%'))
    )
      throw new AdmissionFailure('boundary_unavailable');
    this.allowed = [...new Set(probeAddresses)].sort();
  }
  async close() {
    // A dedicated table owns only signaling admission. RTP for existing calls is
    // untouched. Every supported signaling port is denied except exact test peers.
    // A closed barrier is retained after failed/unknown recovery.
    const exists = await fixed('/usr/sbin/nft', ['-j', 'list', 'tables']);
    let tables: unknown;
    try {
      tables = JSON.parse(exists);
    } catch {
      throw new AdmissionFailure('boundary_unavailable');
    }
    if (
      !tables ||
      typeof tables !== 'object' ||
      !('nftables' in tables) ||
      !Array.isArray(tables.nftables)
    )
      throw new AdmissionFailure('boundary_unavailable');
    const present = tables.nftables.some(
      (v: unknown) =>
        !!v &&
        typeof v === 'object' &&
        'table' in v &&
        !!v.table &&
        typeof v.table === 'object' &&
        'name' in v.table &&
        v.table.name === 'myims_apply',
    );
    const lines = [
      ...(present ? ['delete table inet myims_apply'] : []),
      'add table inet myims_apply',
      'add chain inet myims_apply input { type filter hook input priority -10; policy accept; }',
    ];
    for (const address of this.allowed)
      lines.push(
        `add rule inet myims_apply input ${isIP(address) === 4 ? 'ip' : 'ip6'} saddr ${address} accept`,
      );
    lines.push(
      'add rule inet myims_apply input udp dport { 5060, 5061 } drop',
      'add rule inet myims_apply input tcp dport { 5060, 5061, 8088, 8089 } drop',
    );
    await fixed('/usr/sbin/nft', ['-f', '-'], lines.join('\n') + '\n');
    await this.assertClosed();
  }
  async assertClosed() {
    const rules = await fixed('/usr/sbin/nft', [
      '-j',
      '-n',
      'list',
      'table',
      'inet',
      'myims_apply',
    ]);
    let value: unknown;
    try {
      value = JSON.parse(rules);
    } catch {
      throw new AdmissionFailure('activity_unknown');
    }
    if (
      !value ||
      typeof value !== 'object' ||
      !('nftables' in value) ||
      !Array.isArray(value.nftables)
    )
      throw new AdmissionFailure('activity_unknown');
    // Ignore kernel-assigned handles only; compare every chain and expression.
    const expected = [
      { table: { family: 'inet', name: 'myims_apply' } },
      {
        chain: {
          family: 'inet',
          table: 'myims_apply',
          name: 'input',
          type: 'filter',
          hook: 'input',
          prio: -10,
          policy: 'accept',
        },
      },
      ...this.allowed.map((address) => ({
        rule: {
          family: 'inet',
          table: 'myims_apply',
          chain: 'input',
          expr: [
            {
              match: {
                op: '==',
                left: {
                  payload: {
                    protocol: isIP(address) === 4 ? 'ip' : 'ip6',
                    field: 'saddr',
                  },
                },
                right: address,
              },
            },
            { accept: null },
          ],
        },
      })),
      ...(['udp', 'tcp'] as const).map((protocol) => ({
        rule: {
          family: 'inet',
          table: 'myims_apply',
          chain: 'input',
          expr: [
            {
              match: {
                op: '==',
                left: { payload: { protocol, field: 'dport' } },
                right: {
                  set:
                    protocol === 'udp'
                      ? [5060, 5061]
                      : [5060, 5061, 8088, 8089],
                },
              },
            },
            { drop: null },
          ],
        },
      })),
    ];
    const strip = (v: unknown): unknown =>
      Array.isArray(v)
        ? v.map(strip)
        : v && typeof v === 'object'
          ? Object.fromEntries(
              Object.entries(v)
                .filter(([k]) => k !== 'handle')
                .map(([k, x]) => [k, strip(x)]),
            )
          : v;
    const actual = value.nftables.filter(
      (v: unknown) => !!v && typeof v === 'object' && !('metainfo' in v),
    );
    if (canonical(strip(actual)) !== canonical(expected))
      throw new AdmissionFailure('activity_unknown');
  }
  private async idle(): Promise<boolean> {
    const started = performance.now();
    let output: string;
    try {
      output = await fixed('/usr/sbin/asterisk', [
        '-rx',
        'core show channels count',
      ]);
    } catch {
      throw new AdmissionFailure('activity_unknown');
    }
    const match =
      /^(\d+) active channels?\r?\n(\d+) active calls?\r?\n\d+ calls? processed$/.exec(
        output.trimEnd(),
      );
    if (!match || performance.now() - started > 2000)
      throw new AdmissionFailure('activity_unknown');
    return match[1] === '0' && match[2] === '0';
  }
  private end(deadline: number) {
    const remaining = deadline - Date.now();
    if (!Number.isFinite(remaining) || remaining < 0 || remaining > 120000)
      throw new AdmissionFailure('activity_deadline');
    return performance.now() + remaining;
  }
  /** Before installation only: preserve existing signaling while calls drain. */
  async begin(
    deadline: number,
    signal: AbortSignal,
    guard: () => Promise<void>,
  ) {
    const end = this.end(deadline);
    while (performance.now() < end && !signal.aborted) {
      await guard();
      if (await this.idle()) {
        await guard();
        await this.close();
        if (await this.idle()) {
          await guard();
          return;
        }
        // A call raced barrier acquisition. Configuration is still untouched;
        // reopen this intact gate so that call can finish normally, then retry.
        await guard();
        await this.open();
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new AdmissionFailure('activity_deadline');
  }
  /** Already installed/recovery: retain admission denial on busy or unknown state. */
  async quiet(
    deadline: number,
    signal: AbortSignal,
    guard: () => Promise<void>,
  ) {
    const end = this.end(deadline);
    while (performance.now() < end && !signal.aborted) {
      await guard();
      await this.assertClosed();
      if (await this.idle()) {
        await guard();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new AdmissionFailure('activity_deadline');
  }
  async open() {
    await this.assertClosed();
    await fixed('/usr/sbin/nft', ['delete', 'table', 'inet', 'myims_apply']);
  }
}
