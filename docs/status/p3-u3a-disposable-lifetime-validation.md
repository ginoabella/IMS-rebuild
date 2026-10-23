# P3-U3a — Disposable token lifetime validation

2026-10-19 UTC. **Retained remediation is not authorized. P3-U3a is incomplete.**

Follow-up investigations, client fixes, maintenance rehearsal and additional expiry
findings are recorded in the [2026-10-20 report](p3-u3a-disposable-review-followup.md).
The results below preserve the original checkpoint.

The approved disposable validation found that the original three replacement
policies reject the existing helpers' normal array-form requests. A corrected
complete-array candidate passed the 14-path issuance/request matrix, but the
broader security/lifecycle validation is **not an unqualified pass**: privileged
policy overlap can widen the maximum, accelerated expiry produced HTTP 500, and
a new direct endpoint concurrency probe exposed an intermittent access denial.
All findings remain visible; no negative assertion was weakened to obtain a pass.

## Scope and reproducibility

Only newly initialized, disposable OpenBao was used. Provider image:
`quay.io/openbao/openbao:2.7.1@sha256:6d2b93856e3fcf7b18ad855a0b51eaba474dc8b79cf554379ea32034797d2acf`.
Anonymous health confirmed version `2.7.1`. Each fixture used a unique internal
Docker network, no published ports/named volumes, read-only containers with dropped
capabilities, fresh TLS, Raft in tmpfs, synthetic separate audit storage and
synthetic native userpass credentials. Root-generation endpoints stayed disabled.
Fresh initialization root was held in memory, then explicitly revoked/403 checked;
this was not root recovery. No retained credentials, password file, data/audit
volumes or administrative tokens were accessed or mounted. No retained service was
restarted, no policy/role/token was changed there, and no SIP/PBX contact occurred.

The fixture reproduces the generated installation policies/14 token roles, two
KV-v2 mounts and 900-second native human authentication. Baseline hashes for all
three replacement targets must match the original pure generators before seeding.
Default provider settings outside this relevant configuration are fixture settings;
this is not a claim of a complete retained infrastructure clone or a retained
privileged inventory audit.

Run from the host:

```sh
python3 scripts/openbao/check-token-lifetime-hardening.py --candidate original
python3 scripts/openbao/check-token-lifetime-hardening.py --candidate array
```

Both are diagnostic commands and may exit 1 for the recorded failures. They never
apply changes to retained resources. Each run records only sanitized results in
`docs/status/p3-u3a-disposable-runs/<operation UUID>.json`; summary evidence files
identify the candidate and exact owned container/network names. The launcher uses
only enumerated public-code/fixture mounts and verifies isolation metadata before
testing. Finally it removes only its own named containers/network and temporary
TLS/audit directory, checking their absence. A command timeout or interruption
still enters fixture cleanup; it does not initiate retained containment/recovery.

## Original candidate: failed normal issuance

[Original exact bodies](../planning/p3-u3a-token-lifetime-hardening-manifest.json),
[complete original matrix evidence](p3-u3a-disposable-original-policy-evidence.json).

All 14 existing normal array-form requests returned 403. On all 14 paths the
otherwise equivalent string-form `policies` value returned 200 and its token was
revoked. Requiring all five fields and individually restricting each other field
succeeded in isolated diagnostics; restricting `policies` to a scalar was the
cause of the incompatible positive behavior. This must not be represented as
successful lifetime enforcement: rejecting every ordinary request also masks the
meaning of many negative probes.

The pinned evaluator accepted the complete-array constraint:

```hcl
# Original proposal: matches a scalar string, not the helpers' JSON array.
"policies" = ["exact-policy-name"]

# Corrected candidate: matches the complete one-element JSON array.
"policies" = [["exact-policy-name"]]
```

Only this representation changes in the
[array candidate manifest](../planning/p3-u3a-token-lifetime-hardening-array-manifest.json).
All other policy bytes, paths, capabilities, required parameters and literal values
are preserved. Active provisioning generators and retained policies are unchanged.
The general [OpenBao parameter-constraint documentation](https://openbao.org/docs/2.5.x/concepts/policies/)
supports required/allowed fields but is not a substitute for this observed 2.7.1
array behavior. These constraints apply to token creation, not KV-v2 data fields.

## Corrected candidate: passing matrix and bounded issuance

Final operation `36a2cc33-f2c7-487c-baee-a0a12f5c4de1` ran
2026-10-19 07:26:18.270–07:26:42.758 UTC; diagnostic exit 1.
The [original checkpoint evidence](p3-u3a-disposable-runs/36a2cc33-f2c7-487c-baee-a0a12f5c4de1.json) records
actual response codes and attributes for every path. Across the two approved
installation identifiers:

| Caller policy                    | Exact creation paths                          | Approved request                                                                |
| -------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------- |
| `endpoint-restricted-issuer`     | Four worker/cleanup, two expiry fixture paths | Runtime 1h / explicit 24h / renewable; fixture 1s / explicit 1s / non-renewable |
| `trunk-restricted-issuer`        | Six importer/verifier/cleanup paths           | 1h / explicit 24h / renewable                                                   |
| `platform-deployment-maintainer` | Two fixed platform issuer replacement paths   | 24h / explicit 24h / non-renewable                                              |

Each request also requires its exact one-element policy array and
`no_default_policy: true`. Native human authentication and fixed replacement
issuance are exercised independently of initialization root. Issued tokens are
checked for exact policies, no identity policies/period, orphan status, expected
renewability, initial TTL and explicit maximum. One-second lookups can report
zero seconds due to rounding; issuance must still return a one-second lease and
expiry must subsequently return 403. This is not a zero/unbounded lifetime request.

All **14 approved path requests returned 200**. All **434 negative requests**
(31 per path) returned 403: each missing required field, excessive TTL/max together
or separately, zero maxima/TTLs, alternate equivalent numeric/string durations,
root/default/other-installation/extra/empty/string policies, false or string default
suppression, changed renewability, periodic requests (including zero period),
display name, use limits, orphan override, token type, entity alias and unknown
parameters. No unexpected negative-test token remained live.

Alternative generic/orphan/fixed/cross-lifecycle/unknown-installation issuance,
policy writes and role writes by ordinary issuers were denied. A normal issuer
could not request an extra overlap policy. Synthetic target role maxima of zero
and 48 hours did not defeat the request constraints: ordinary issuance remained
24-hour explicit maximum and the 48-hour override request was rejected. The
role-period probe's actual stored fields and lookup result are recorded separately:
`token_period: 3600`, legacy `period: 0`, no lookup `period`, explicit maximum
86,400. No issued-period bypass was demonstrated in that probe; its JSON field
retains the exploratory name `privilegedRolePeriodCounterexample`. Do not infer
periodic behavior from a submitted role field alone.

The unchanged runtime issuance CLI was exercised for endpoint worker/cleanup and
trunk importer/verifier/cleanup, in both installations: ten successful issue,
attribute-validation and verified revocation cases. The fixed issuer helper's
old-policy preflight is deliberately not relaxed: its expected-body generation
must be updated only as part of a separately approved retained deployment. Direct
fixed-role calls and real userpass authentication establish the provider contract
here, not a claim that an unchanged old-body deployment preflight accepts new bodies.

## Counterexamples, errors and limits

**Overlapping policy is a real counterexample.** An initialization-root-created
synthetic token bearing the hardened trunk issuer policy plus a second exact-path
policy allowing `48h` obtained a token with `explicit_max_ttl: 172800`. That child
and the synthetic caller were revoked/403 checked. An unconstrained exact-path
addition and a less-specific wildcard addition did not bypass this particular
request; the explicitly widened same-path constraint did. Provider parameter
constraints therefore do not establish an immutable ceiling against arbitrary
privileged policy assignment. Approved ordinary issuer and human identities have
one exact token policy and no extra identity policies in these tests. Existing
prefix human policy/role maintenance remains a trusted administrative boundary;
this test does not turn that trust into provider-enforced approval. Any future
unexpected identity/policy overlap must stop maintenance. No application-only
check is proposed as a substitute for provider enforcement.

**Absolute lifetime: attribute proof plus accelerated behavior, not a 24-hour soak.**
Real normal/fixed tokens had explicit maximum 86,400 seconds. An analogous exact
2-second initial / 6-second absolute fixture was repeatedly renewed requesting
48 hours. Successful renewals shortened toward the absolute boundary and final
lookup after the boundary returned 403. However, OpenBao returned **HTTP 500** near
expiry without an auth result. The harness retains that as a failure and exits 1;
it does not relabel 500 as a successful expected denial. No renewal beyond the
approved absolute boundary was observed. An actual 24-hour elapsed soak was not
performed; do not claim it was. Provider error behavior and the boundary test
limitation require review before a clean lifecycle acceptance claim.

**Direct endpoint concurrent prepare:** some disposable runs produced one fulfilled
prepare and one `provider_access_denied` when both callers raced to create the
same CAS-zero generation. Subsequent exact replay/verification and cleanup are
recorded separately. The test keeps this as a failed concurrency assertion and
continues independent checks. Endpoint data policies and adapter implementation
were not changed by this work. This is a new direct adapter probe, not proof that
the already-tested owner/API recovery failed; the cause and recovery implications
remain for review. Early fixture revisions also stopped on the overly strict
positive-TTL assertion for one-second rounded lookups; the final test distinguishes
that rounding from actual issuance/expiry and preserves earlier archived failures.

## Regression coverage and exclusions

Real endpoint checks cover missing material, concurrent prepare (including the
failure above), exact replay/verification, cross-installation denial, forbidden
worker overwrite/destroy and cleanup create, bounded renewal, exact destruction
and destruction replay, plus one-second expiry. The existing
`check-trunk-provider.mjs` runs unchanged with disposable issuer custody: immutable
import, verify, exact replay, changed-material conflict, cross-installation and
write/destroy/issuance denials, bounded renewal, owned version destruction and
verified token revocation. Original negative security assertions remain intact.

Scoped `pnpm check:trunk-preparation` passed **18/18**, exit 0, including backend
build, no-custody refusal, read-only preflight, unknown-privilege rejection,
backup-gate checks, material grammar/HTTPS adapter and recovery guard tests.
New fixture source lint and Python syntax checks passed. Full `./dev check` and
the retained endpoint SQL/Redis/HTTP integration launcher were **not run** under
this authorization because their provider operations can touch/restart retained
OpenBao. Previous real endpoint integration results remain historical evidence;
they are not claimed as newly rerun here. New trunk owner PostgreSQL/Redis/two-HTTP
replica and recovery/cleanup race acceptance remains outstanding with P3-U3a.

## Cleanup and next review

The final worker verified 45 known token revocations and seven already-expired
403 results, with zero known tokens left. Its trunk subprocess independently
verified four child-token revocations.

Every complete run records known-token self-revocation and subsequent 403, or
already-expired 403; initialization root is revoked last. The independent trunk
regression records its own four child-token revocations. All final known tokens
are accounted for before fixture teardown. Container/network/directory absence is
recorded in each evidence object; no named volumes were created. Synthetic audit,
TLS private key and tmpfs storage are removed, while sanitized evidence is retained.
No fixture action restores or alters retained configuration.

The [separate maintenance/backup proposal](../archive/p3-u3/2026-10-23/docs/planning/p3-u3a-retained-lifetime-maintenance-proposal.md)
identifies missing snapshot/self-policy authority, the backup-before-change
bootstrap conflict, a tightly scoped rootless option requiring further disposable
rehearsal and explicit exception approval, restoration prerequisites and risks.
It is **not ready for retained execution**. Required review covers corrected array
matching, the overlap/expiry/concurrency findings and the chosen backup authority
route. No additional root recovery or retained modification is authorized.
