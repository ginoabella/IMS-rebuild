import { routeIdentity } from './route-identity';
import { settings as profileSettings } from './inventory';
import type {
  RevisionDiagnostic,
  RevisionResource,
  RevisionDiff,
  RevisionSummary,
  GroupDestination,
} from '@myims/contracts';
import { entries, canonical, type RevisionSnapshot } from './revision-snapshot';
import {
  groupValues,
  inboundValues,
  outboundValues,
  reservationValues,
  validateGraph,
  intersects,
  transformedDomain,
} from './routing';
import { settings as peerSettings, address } from './peer';
/** A typed, nonmaterialized plan. No CLI/context/path/application text is accepted. */
export function compileRevision(s: RevisionSnapshot) {
  const diagnostics: RevisionDiagnostic[] = [];
  let failed = false;
  const add = (
    code: string,
    resourceId: string | null = null,
    severity: 'error' | 'blocker' = 'error',
  ) => {
    if (severity === 'error') failed = true;
    if (diagnostics.length < 511)
      diagnostics.push({ code, resourceId, severity });
  };
  const sources = entries(s);
  if (
    !s.eligibility ||
    Object.values(s.eligibility).some((v) => v !== 'unavailable')
  )
    add('unsupported_eligibility');
  const extensions = new Map(s.extensions.map((x) => [x.id, x]));
  const groups = new Map(s.groups.map((x) => [x.id, x]));
  const trunks = new Map(s.trunks.map((x) => [x.id, x]));
  const gateways = new Map(s.gateways.map((x) => [x.id, x]));
  const dids = new Map(s.dids.map((x) => [x.id, x]));
  const destination = (d: GroupDestination) =>
    d.kind === 'hangup' ||
    (d.kind === 'extension' ? extensions.has(d.id) : groups.has(d.id));
  const unsafe = (v: unknown): boolean =>
    typeof v === 'string'
      ? // eslint-disable-next-line no-control-regex -- configuration data must exclude NUL and line injection.
        /[\r\n\u0000]/.test(v)
      : Array.isArray(v)
        ? v.some(unsafe)
        : v !== null && typeof v === 'object'
          ? Object.values(v).some(unsafe)
          : false;
  if (sources.length > 2048 || s.groups.length > 512 || s.outbound.length > 512)
    add('compiler_limit');
  for (const e of sources)
    if (unsafe(e.value)) add('configuration_injection', e.value.id);
  for (const r of [...s.inbound, ...s.outbound])
    if (
      canonical(r.identity) !==
      canonical(routeIdentity(s.node.installationId, r.id))
    )
      add('invalid_route_identity', r.id);
  for (const p of s.profiles) {
    try {
      const expected = profileSettings(p.kind, {
        codecs: p.settings.codecs,
        maxContacts: p.settings.maxContacts,
      });
      if (canonical(expected) !== canonical(p.settings))
        add('unsupported_profile', p.id);
    } catch {
      add('unsupported_profile', p.id);
    }
    const c = s.capability;
    if (
      !c ||
      p.capabilityRevision !== c.version ||
      !c.kinds.includes(p.kind) ||
      !c.signaling.includes(p.settings.signaling) ||
      !c.media.includes(p.settings.mediaEncryption) ||
      p.settings.codecs.some((x) => !c.codecs.includes(x))
    )
      add('unsupported_profile', p.id);
  }
  for (const e of s.extensions) {
    const prefix =
      s.node.installationId.replaceAll('-', '') +
      '-' +
      e.id.replaceAll('-', '');
    if (
      e.endpointKey !== `ims-e-${prefix}` ||
      e.authKey !== `ims-a-${prefix}` ||
      e.aorKey !== `ims-r-${prefix}`
    )
      add('invalid_endpoint_identity', e.id);
    if (
      !s.profiles.some(
        (p) =>
          p.id === e.profileId &&
          p.version === e.profileVersion &&
          p.kind === e.kind,
      )
    )
      add('missing_profile', e.id);
    add(
      e.administrativeStatus === 'disabled'
        ? 'disabled_inventory'
        : 'unallocated_inventory',
      e.id,
      'blocker',
    );
    if (
      e.generationId &&
      !s.credentials.some(
        (c) =>
          c.id === e.generationId && c.purpose === 'endpoint' && c.available,
      )
    )
      add('credential_unavailable', e.id);
  }
  for (const t of s.trunks) {
    try {
      peerSettings(t.settings);
    } catch {
      add('invalid_trunk', t.id);
    }
    const c = t.settings.credential;
    if (
      c &&
      !s.credentials.some(
        (x) =>
          x.id === c.id &&
          x.version === c.version &&
          x.available &&
          x.purpose === 'outbound-digest',
      )
    )
      add('credential_unavailable', t.id);
  }
  for (const g of s.gateways) {
    try {
      g.sourceAddresses.forEach(address);
    } catch {
      add('invalid_source', g.id);
    }
    if (g.trunkId && !trunks.has(g.trunkId)) add('missing_trunk', g.id);
  }
  for (const d of s.dids)
    if (!gateways.has(d.gatewayId)) add('missing_gateway', d.id);
  for (const g of s.groups) {
    try {
      groupValues({ ...g });
    } catch {
      add('invalid_group', g.id);
    }
    if (g.memberIds.some((x) => !extensions.has(x)) || !destination(g.fallback))
      add('missing_destination', g.id);
    add('unbound_group', g.id, 'blocker');
  }
  try {
    validateGraph(s.groups);
  } catch {
    add('invalid_fallback_graph');
  }
  for (const r of s.reservations) {
    try {
      reservationValues({ ...r });
    } catch {
      add('invalid_reservation', r.id);
    }
  }
  for (const r of s.inbound) {
    try {
      inboundValues({ ...r });
    } catch {
      add('invalid_inbound', r.id);
    }
    if (
      !gateways.has(r.gatewayId) ||
      !destination(r.destination) ||
      (r.didId && dids.get(r.didId)?.gatewayId !== r.gatewayId)
    )
      add('missing_destination', r.id);
    add('unbound_route', r.id, 'blocker');
  }
  for (const r of s.outbound) {
    try {
      outboundValues({ ...r });
    } catch {
      add('invalid_outbound', r.id);
    }
    if (
      !trunks.has(r.trunkId) ||
      trunks.get(r.trunkId)?.direction === 'inbound'
    )
      add('missing_trunk', r.id);
    if (
      s.reservations.some(
        (x) =>
          intersects(x.pattern, r.pattern) ||
          intersects(x.pattern, transformedDomain(r)),
      )
    )
      add('reserved_number', r.id);
    if (
      s.outbound.some(
        (x) =>
          x.id !== r.id &&
          x.priority === r.priority &&
          intersects(x.pattern, r.pattern),
      )
    )
      add('priority_conflict', r.id);
    add('unbound_route', r.id, 'blocker');
  }
  add('U5-01', null, 'blocker');
  add('U5-04', null, 'blocker');
  add('U5-05', null, 'blocker');
  if (diagnostics.length === 511)
    diagnostics.push({
      code: 'diagnostics_truncated',
      resourceId: null,
      severity: 'blocker',
    });
  const plan = {
    profiles: s.profiles,
    endpoints: s.extensions.map((e) => ({
      ...e,
      callingEligible: false as const,
    })),
    trunks: s.trunks,
    gateways: s.gateways,
    dids: s.dids,
    groups: s.groups,
    reservations: s.reservations,
    inbound: [...s.inbound].sort(
      (a, b) =>
        Number(a.didId === null) - Number(b.didId === null) ||
        a.id.localeCompare(b.id),
    ),
    outbound: [...s.outbound].sort(
      (a, b) => a.priority - b.priority || a.id.localeCompare(b.id),
    ),
    defaults: {
      unknownIngress: 'deny',
      unmatchedOutbound: 'deny',
      disabledWinner: 'deny',
      unbound: 'deny',
      reservationInput: 'deny',
      reservationOutput: 'deny',
    } as const,
  };
  return {
    plan,
    diagnostics,
    local: failed ? ('failed' as const) : ('passed' as const),
  };
}
export function credentialReferences(value: object): string[] {
  const v = value as Record<string, unknown>;
  if (typeof v.generationId === 'string') return [`endpoint:${v.generationId}`];
  if (
    v.settings &&
    typeof v.settings === 'object' &&
    'credential' in v.settings
  ) {
    const c = v.settings.credential as
      { id: string; version: number } | undefined;
    return c ? [`trunk:${c.id}:${c.version}`] : [];
  }
  return [];
}
export function reviewResources(s: RevisionSnapshot): RevisionResource[] {
  return entries(s).map((e) => ({
    kind: e.kind,
    id: e.value.id,
    version: e.value.version,
    name:
      'name' in e.value
        ? String(e.value.name)
        : 'number' in e.value
          ? String(e.value.number)
          : e.kind,
    callingEligible: false,
    credentialReferences: credentialReferences(e.value),
  }));
}
export function semanticDiff(
  s: RevisionSnapshot,
  base: RevisionSnapshot | null,
  baseline: RevisionSummary | null,
): RevisionDiff {
  const old = new Map(
    (base ? entries(base) : []).map((e) => [`${e.kind}:${e.key}`, e]),
  );
  const now = new Map(entries(s).map((e) => [`${e.kind}:${e.key}`, e]));
  const changes: RevisionDiff['changes'] = [];
  for (const key of [...new Set([...old.keys(), ...now.keys()])].sort()) {
    const a = old.get(key),
      b = now.get(key),
      entry = b ?? a!;
    if (a && b && canonical(a.value) === canonical(b.value)) continue;
    const av = a?.value as Record<string, unknown> | undefined,
      bv = b?.value as Record<string, unknown> | undefined;
    const fields = [
      ...new Set([...Object.keys(av ?? {}), ...Object.keys(bv ?? {})]),
    ]
      .filter(
        (k) =>
          canonical(av?.[k] ?? null) !== canonical(bv?.[k] ?? null) &&
          !['identity', 'endpointKey', 'authKey', 'aorKey'].includes(k),
      )
      .sort();
    const display = (v: unknown) =>
      v === undefined || v === null
        ? null
        : canonical(v).length > 2048
          ? canonical(v).slice(0, 2047) + '…'
          : canonical(v);
    changes.push({
      kind: entry.kind,
      id: entry.value.id,
      name:
        'name' in entry.value
          ? String(entry.value.name)
          : 'number' in entry.value
            ? String(entry.value.number)
            : entry.kind,
      change: !a ? 'added' : !b ? 'removed' : 'edited',
      fields,
      values: fields.map((field) => ({
        field,
        before: display(av?.[field]),
        after: display(bv?.[field]),
      })),
      credentialReferenceChanged:
        canonical(credentialReferences(a?.value ?? {})) !==
        canonical(credentialReferences(b?.value ?? {})),
    });
  }
  return {
    baseline,
    runtime: { kind: 'no_verified_runtime', drift: 'unknown' },
    changes,
  };
}
