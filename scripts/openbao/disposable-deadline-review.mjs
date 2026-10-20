// Fresh fixture token only; observed application admission is independent of raw provider failures.
import { performance } from 'node:perf_hooks';
import { AuthorizationDeadlineCandidate } from './authorization-deadline-candidate.mjs';
export async function reviewDeadline({
  api,
  required,
  remember,
  revoke,
  need,
  issuer,
  role,
}) {
  const token = (
    await required(
      'auth/token/create/' + role,
      {
        policies: [role],
        ttl: '2s',
        explicit_max_ttl: '6s',
        no_default_policy: true,
        renewable: true,
      },
      issuer,
    )
  ).auth.client_token;
  const identity = (await required('auth/token/lookup-self', undefined, token))
    .data;
  const guard = new AuthorizationDeadlineCandidate(
    identity,
    {
      wall: () => Date.now(),
      monotonic: () => performance.now(),
      healthy: () => true,
    },
    {
      maximumSeconds: 6,
      expectedPolicy: role,
      skewBoundMs: 100,
      safetyMarginMs: 100,
      minimumRenewalSeconds: 1,
    },
  );
  const original = Date.parse(identity.issue_time),
    observations = [];
  let admitted = 0,
    denied = 0,
    firstDenialMs = null,
    renewals = 0;
  while (Date.now() - original < 7300) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    let allowed = true;
    try {
      guard.check(25);
    } catch {
      allowed = false;
      denied++;
      firstDenialMs ??= Date.now() - original;
    }
    if (allowed) {
      const response = await api(
        'auth/token/renew-self',
        { increment: '48h' },
        token,
      );
      remember(response);
      const lookup = await api('auth/token/lookup-self', undefined, token);
      try {
        guard.observeRenewal(response, lookup.value.data);
        await guard.run(async () => true, 25);
        need(Date.now() - original < 6000, 'deadline_admitted_past_maximum');
        admitted++;
        renewals++;
      } catch {
        allowed = false;
        denied++;
        firstDenialMs ??= Date.now() - original;
      }
    }
    const control = await api('auth/token/lookup-self', undefined, token);
    observations.push({
      elapsedMs: Date.now() - original,
      applicationAdmitted: allowed,
      providerLookup: control.status,
      providerExpiryOverrunMs:
        control.status === 200
          ? Date.parse(control.value.data.expire_time) - (original + 6000)
          : null,
    });
  }
  need(
    admitted > 0 && denied > 0 && firstDenialMs < 6000,
    'deadline_availability_or_boundary_failed',
  );
  need(
    !observations.some((r) => r.applicationAdmitted && r.elapsedMs >= 6000),
    'deadline_late_authorization',
  );
  await revoke(token);
  return {
    status: 'disposable_deadline_probe_passed',
    runtimeIntegrated: false,
    approvedMaximumSeconds: 6,
    productionMaximumSeconds: 86400,
    productionMarginIsProposal: true,
    real24HourSoak: false,
    localClockHealthAssumedOnlyInFixture: true,
    admitted,
    denied,
    renewals,
    firstDenialMs,
    observations,
  };
}
