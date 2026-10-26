import { isIP } from 'node:net';
import { compileRevision } from '../../domain/revision-compiler';
import type { RevisionSnapshot } from '../../domain/revision-snapshot';
import type { GroupDestination, NumberPattern } from '@myims/contracts';
import type { ManagedArtifacts } from './artifact-store';
import { uuid } from '../../../identity/domain/storage';
export class LiveCompilationFailure extends Error {
  constructor(
    readonly code:
      | 'configuration_invalid'
      | 'unsupported_live_profile'
      | 'material_unrepresentable'
      | 'material_missing',
  ) {
    super('Live PBX compilation unavailable');
  }
}
export interface LiveMaterial {
  endpoints: Map<string, { password: string }>;
  trunks: Map<string, { username: string; password: string; realm: string }>;
}
const compact = (id: string) => id.replaceAll('-', '');
export function runtimeNames(s: RevisionSnapshot, revisionId: string) {
  const node = compact(s.node.id);
  return {
    marker: `ims-rev-${compact(revisionId)}`,
    deny: `ims-deny-${node}`,
    outbound: `ims-out-${node}`,
    group: (id: string) => `ims-group-${compact(id)}`,
    inbound: (id: string) => `ims-in-${compact(id)}`,
    trunk: (id: string) => `ims-t-${node}-${compact(id)}`,
  };
}
function pattern(p: NumberPattern): string {
  return `^${p.digits}[0-9]{${p.minLength - p.digits.length},${p.maxLength - p.digits.length}}$`;
}
/** Protected typed rendering only. Unallocated endpoints and unbound ingress use deny. */
export function materializeRevision(
  s: RevisionSnapshot,
  revisionId: string,
  material: LiveMaterial,
): ManagedArtifacts {
  if (!uuid(revisionId) || compileRevision(s).local !== 'passed')
    throw new LiveCompilationFailure('configuration_invalid');
  const names = runtimeNames(s, revisionId),
    pjsip: string[] = [],
    dialplan: string[] = [];
  const safe = (value: string) => {
    // The simple credential importer accepts printable bytes. Until the pinned
    // Asterisk parser proves an escape, reject metacharacters instead of changing
    // the exact credential silently or allowing config/comment substitution.
    if (!/^[a-zA-Z0-9_.+@!#$%&*()=:/?^-]{1,1024}$/.test(value))
      throw new LiveCompilationFailure('material_unrepresentable');
    return value;
  };
  const section = (id: string, fields: Record<string, string | number>) => {
    pjsip.push(
      `[${id}]`,
      ...Object.entries(fields).map(([k, v]) => `${k}=${v}`),
      '',
    );
  };
  section(names.marker, {
    type: 'endpoint',
    context: names.deny,
    disallow: 'all',
    allow: 'ulaw',
    direct_media: 'no',
  });
  dialplan.push(
    `[${names.deny}]`,
    'exten => s,1,Hangup()',
    'exten => _.,1,Hangup()',
    '',
    `[${names.marker}]`,
    'exten => s,1,Hangup()',
    '',
  );
  for (const e of s.extensions) {
    if (e.administrativeStatus !== 'enabled') continue;
    if (e.kind !== 'sip')
      throw new LiveCompilationFailure('unsupported_live_profile');
    const profile = s.profiles.find(
      (p) => p.id === e.profileId && p.version === e.profileVersion,
    );
    const password = e.generationId
      ? material.endpoints.get(e.generationId)?.password
      : null;
    if (!password || !profile)
      throw new LiveCompilationFailure('material_missing');
    section(e.endpointKey, {
      type: 'endpoint',
      transport: 'transport-udp',
      context: names.deny,
      auth: e.authKey,
      aors: e.aorKey,
      disallow: 'all',
      allow: profile.settings.codecs.join(','),
      direct_media: 'no',
      rtp_symmetric: 'yes',
      force_rport: 'yes',
      rewrite_contact: profile.settings.rewriteContact ? 'yes' : 'no',
      ice_support: 'no',
      use_avpf: 'no',
      rtcp_mux: 'no',
      media_encryption: 'no',
      media_use_received_transport: 'no',
    });
    section(e.authKey, {
      type: 'auth',
      auth_type: 'userpass',
      username: e.endpointKey,
      password: safe(password),
    });
    section(e.aorKey, {
      type: 'aor',
      max_contacts: profile.settings.maxContacts,
      remove_existing: 'no',
    });
  }
  for (const t of s.trunks) {
    const key = names.trunk(t.id),
      reference = t.settings.credential;
    let auth: Record<string, string> = {};
    if (reference) {
      const exact = material.trunks.get(`${reference.id}:${reference.version}`);
      if (!exact) throw new LiveCompilationFailure('material_missing');
      auth = { outbound_auth: key + '-auth' };
      section(key + '-auth', {
        type: 'auth',
        auth_type: 'userpass',
        username: safe(exact.username),
        password: safe(exact.password),
        realm: safe(exact.realm),
      });
    }
    const host =
      isIP(t.settings.host) === 6 ? `[${t.settings.host}]` : t.settings.host;
    section(key, {
      type: 'endpoint',
      transport: 'transport-udp',
      context: names.deny,
      aors: key + '-aor',
      ...auth,
      disallow: 'all',
      allow: t.settings.codecs.join(','),
      direct_media: 'no',
      rtp_symmetric: 'yes',
      force_rport: 'yes',
    });
    section(key + '-aor', {
      type: 'aor',
      contact: `sip:${host}:${t.settings.port}`,
      qualify_frequency: 0,
    });
    // Pre-onboarding denies registration/tenant egress. Desired registration is
    // retained in the exact snapshot; it cannot create an unbound REGISTER flow.
  }
  const routeContext = (
    r:
      | RevisionSnapshot['inbound'][number]
      | RevisionSnapshot['outbound'][number],
  ) => `ims-route-${r.identity.contextHash}`;
  const attribution = (
    r:
      | RevisionSnapshot['inbound'][number]
      | RevisionSnapshot['outbound'][number],
  ) => [
    `Set(MYIMS_ROUTE_SOURCE=${r.identity.sourceKey})`,
    `Set(MYIMS_ROUTE_WATCH=${r.identity.watchIdentity})`,
    `Set(MYIMS_ROUTE_ATTRIBUTION=${r.identity.attributionKey})`,
    `Set(MYIMS_ROUTE_VERSION=${r.version})`,
  ];
  const target = (d: GroupDestination): string => {
    if (d.kind === 'hangup') return 'Hangup()';
    if (d.kind === 'group') return `Goto(${names.group(d.id)},s,1)`;
    const e = s.extensions.find((x) => x.id === d.id);
    return e?.administrativeStatus === 'enabled'
      ? `Dial(PJSIP/${e.endpointKey},15)`
      : 'Hangup()';
  };
  for (const g of s.groups) {
    dialplan.push(`[${names.group(g.id)}]`);
    if (!g.enabled) {
      dialplan.push('exten => s,1,Hangup()', '');
      continue;
    }
    const members = g.memberIds
      .map((id) => s.extensions.find((e) => e.id === id))
      .filter(
        (e): e is RevisionSnapshot['extensions'][number] =>
          e?.administrativeStatus === 'enabled',
      );
    let priority = 1;
    if (g.strategy === 'simultaneous' && members.length)
      dialplan.push(
        `exten => s,${priority++},Dial(${members.map((e) => `PJSIP/${e.endpointKey}`).join('&')},${g.timeout})`,
      );
    else
      for (const e of members)
        dialplan.push(
          `exten => s,${priority++},Dial(PJSIP/${e.endpointKey},${g.timeout})`,
        );
    dialplan.push(`exten => s,${priority},${target(g.fallback)}`, '');
  }
  for (const gateway of s.gateways) {
    const context = names.inbound(gateway.id);
    dialplan.push(`[${context}]`);
    const rules = s.inbound
      .filter((r) => r.gatewayId === gateway.id)
      .sort(
        (a, b) =>
          Number(a.didId === null) - Number(b.didId === null) ||
          a.id.localeCompare(b.id),
      );
    for (const r of rules) {
      const did = r.didId ? s.dids.find((d) => d.id === r.didId) : null;
      const extension = did?.number ?? '_.';
      dialplan.push(`exten => ${extension},1,Goto(${routeContext(r)},s,1)`);
    }
    if (!rules.some((r) => r.didId === null))
      dialplan.push('exten => _.,1,Hangup()');
    dialplan.push('');
    for (const r of rules) {
      const did = r.didId ? s.dids.find((d) => d.id === r.didId) : null;
      dialplan.push(`[${routeContext(r)}]`);
      const steps = [
        ...attribution(r),
        gateway.enabled && r.enabled && (!did || did.enabled)
          ? target(r.destination)
          : 'Hangup()',
      ];
      steps.forEach((step, index) =>
        dialplan.push(`exten => s,${index + 1},${step}`),
      );
      dialplan.push('');
    }
  }
  const reserved = (digits: string) =>
    s.reservations.map(
      (r) =>
        `GotoIf($["\${REGEX("${pattern(r.pattern)}" ${digits})}" = "1"]?${names.deny},s,1)`,
    );
  dialplan.push(`[${names.outbound}]`);
  dialplan.push('exten => _.,1,Set(MYIMS_ORIGINAL=${EXTEN})');
  let priority = 2;
  for (const check of reserved('${EXTEN}'))
    dialplan.push(`exten => _.,${priority++},${check}`);
  const ordered = [...s.outbound].sort(
    (a, b) => a.priority - b.priority || a.id.localeCompare(b.id),
  );
  for (const r of ordered)
    dialplan.push(
      `exten => _.,${priority++},GotoIf($["\${REGEX("${pattern(r.pattern)}" \${EXTEN})}" = "1"]?${routeContext(r)},s,1)`,
    );
  dialplan.push(`exten => _.,${priority},Hangup()`, 'exten => deny,1,Hangup()');
  for (const r of ordered) {
    dialplan.push(`[${routeContext(r)}]`);
    const extension = 's',
      trunk = s.trunks.find((t) => t.id === r.trunkId);
    attribution(r).forEach((step, index) =>
      dialplan.push(`exten => s,${index + 1},${step}`),
    );
    if (!r.enabled || !trunk?.enabled) {
      dialplan.push(`exten => ${extension},5,Hangup()`);
      continue;
    }
    let step = 5;
    const transformed = `${r.addPrefix}\${MYIMS_ORIGINAL:${r.stripCount}}`;
    // Goto replaces EXTEN: retain the caller's original number before route dispatch.
    for (const check of reserved(transformed))
      dialplan.push(`exten => ${extension},${step++},${check}`);
    dialplan.push(
      `exten => ${extension},${step},Dial(PJSIP/${transformed}@${names.trunk(trunk.id)},15)`,
    );
  }
  const files = {
    pjsip: Buffer.from(pjsip.join('\n') + '\n'),
    dialplan: Buffer.from(dialplan.join('\n') + '\n'),
  };
  if (files.pjsip.length + files.dialplan.length > 4 * 1024 * 1024)
    throw new LiveCompilationFailure('configuration_invalid');
  return files;
}
