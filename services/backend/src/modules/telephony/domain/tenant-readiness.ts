import type { RevisionSnapshot } from './revision-snapshot';
import { tenantRouting } from './tenant-routing';
export interface TenantEvidence {
  direction: 'inbound' | 'outbound';
  permitted: boolean;
  expected: boolean;
  current: boolean;
  createdAt: Date;
}
/** Readiness is a current projection, never tenant lifecycle or registration. */
export function tenantReadiness(
  s: RevisionSnapshot,
  tenantId: string,
  runtimeCurrent: boolean,
  testsPending: boolean,
  evidence: TenantEvidence[],
  now: Date,
) {
  const t = s.tenantRouting?.tenants.find((t) => t.id === tenantId);
  if (!t)
    return { state: 'incomplete' as const, blockers: ['ownership_missing'] };
  if (t.voicePreference === 'disabled')
    return { state: 'not_required' as const, blockers: [] };
  const blockers: string[] = [];
  if (t.voicePreference !== 'enabled') blockers.push('voice_not_configured');
  const routing = tenantRouting(s);
  if (!routing.valid || !routing.target(tenantId))
    blockers.push('tenant_ineligible');
  if (!s.extensions.some((e) => routing.extension(tenantId, e.id)))
    blockers.push('allocation_missing');
  if (!runtimeCurrent) blockers.push('runtime_not_current');
  if (testsPending) blockers.push('test_pending_or_unknown');
  for (const direction of ['inbound', 'outbound'] as const) {
    const required = evidence
      .filter((e) => e.direction === direction && e.expected)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const latest = required[0];
    const age = latest ? now.getTime() - latest.createdAt.getTime() : Infinity;
    if (
      !latest?.permitted ||
      !latest.current ||
      age < 0 ||
      age >= 24 * 60 * 60 * 1000
    )
      blockers.push(`${direction}_verification_required`);
  }
  return {
    state: blockers.length ? ('incomplete' as const) : ('ready' as const),
    blockers,
  };
}
