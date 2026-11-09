// Passive private-namespace counters. No socket, packet capture, call or verdict.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
export function observeControlledPackets(action, id) {
  if (
    process.getuid() !== 0 ||
    !['start', 'status', 'stop'].includes(action) ||
    !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id ?? '')
  )
    throw new Error('Exact observation required');
  const table = 'myims_prep_observe_' + id.replaceAll('-', '');
  const nft = (args, input) =>
    execFileSync('/usr/sbin/nft', args, {
      input,
      encoding: 'utf8',
      timeout: 3000,
      maxBuffer: 65536,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  const tables = JSON.parse(nft(['-j', 'list', 'tables']));
  const present = tables.nftables.some(
    (v) => v.table?.family === 'inet' && v.table?.name === table,
  );
  if (!present && action === 'start')
    nft(
      ['-f', '-'],
      [
        `add table inet ${table}`,
        ...['sip_invites', 'sip_registers', 'rtp_packets'].map(
          (name) => `add counter inet ${table} ${name}`,
        ),
        `add chain inet ${table} output { type filter hook output priority 10; policy accept; }`,
        `add rule inet ${table} output meta l4proto udp udp dport { 5060, 20020, 20021 } @th,64,48 0x494e56495445 counter name sip_invites`,
        `add rule inet ${table} output meta l4proto udp udp dport 5060 @th,64,64 0x5245474953544552 counter name sip_registers`,
        `add rule inet ${table} output meta l4proto udp udp sport 10000-10100 counter name rtp_packets`,
        `add rule inet ${table} output meta l4proto udp udp dport 10000-10100 counter name rtp_packets`,
      ].join('\n') + '\n',
    );
  else if (!present)
    return { observationId: id, state: 'not_observing', counts: null };
  const data = JSON.parse(nft(['-j', 'list', 'table', 'inet', table])).nftables;
  const counters = data.filter((v) => v.counter).map((v) => v.counter);
  const chains = data.filter((v) => v.chain).map((v) => v.chain);
  const rules = data.filter((v) => v.rule).map((v) => v.rule);
  const names = ['sip_invites', 'sip_registers', 'rtp_packets'];
  if (
    counters.length !== 3 ||
    !names.every((name) =>
      counters.some(
        (c) =>
          c.name === name && Number.isSafeInteger(c.packets) && c.packets >= 0,
      ),
    ) ||
    chains.length !== 1 ||
    chains[0].hook !== 'output' ||
    chains[0].policy !== 'accept' ||
    rules.length !== 4 ||
    rules.some(
      (r) =>
        r.chain !== 'output' ||
        r.expr.some((e) =>
          Object.keys(e).some((k) => !['match', 'counter'].includes(k)),
        ),
    )
  )
    throw new Error('Observation ownership unavailable');
  const counts = Object.fromEntries(counters.map((c) => [c.name, c.packets]));
  if (action === 'stop') nft(['delete', 'table', 'inet', table]);
  return {
    observationId: id,
    state: action === 'stop' ? 'stopped' : 'observing',
    counts,
  };
}
if (process.argv[2] === '--observe-native') {
  try {
    const input = JSON.parse(process.argv[3]);
    const load = createRequire('/workspace/services/backend/package.json');
    const { liveConfiguration } = load(
      './dist/modules/telephony/adapters/live/configuration.js',
    );
    const config = liveConfiguration(
      '/run/pbx-live-native/configuration.json',
      false,
    );
    if (
      config.nodeId !== input.nodeId ||
      config.installationId !== input.installationId
    )
      throw new Error();
    console.log(
      JSON.stringify(
        observeControlledPackets(input.action, input.observationId),
      ),
    );
  } catch {
    console.error(
      'Passive controlled-traffic observation unavailable; no call or packet contents exposed.',
    );
    process.exitCode = 2;
  }
}
