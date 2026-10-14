# P3-U1b observation and recovery evidence

Recorded 2026-10-14 (Asia/Manila, +08:00). **B-01–09 complete for approved development observation;
final full Docker graph passed, exit 0, 2026-10-14 17:44 +08:00.**
Requirement: [P3-U1b B-01–09](../../context/feature-specs/p3-u1b-fenced-asterisk-observation-and-recovery.md).
Policy: [conditional development approval](../planning/p3-u1b-observation-contract-review.md).
Contracts/operations: [observation](../architecture/pbx-observation.md),
[runbook](../runbooks/pbx-observation.md), [registry](../architecture/pbx-registry.md).

## Environment and exact settings

Existing isolated Compose Asterisk 22.10.1, actual authenticated AMI-TLS on
private TCP 5039 with verified service name `asterisk` and provisioned development
CA. No management host publication; plaintext AMI is container-loopback only;
HTTP/ARI remains disabled. Node 22.23.3 runs in Docker. PostgreSQL/PostGIS uses
real restricted `myims_runtime` grants; deployment alone migrates. Isolated Redis
and protected HTTP use the established platform cookie/CSRF/current-authority
boundary. Independent OS telephony fixtures and two actual shipping entry points
exercise the delivered engine; ordinary HTTP/worker graphs start no observers.

Account `system` action permissions exceed the application allowlist. The
account is **not strictly read-only at the PBX**. Real fixed probes confirmed
Command, Originate and UpdateConfig permission denial. No valid mutating request
or `system`-class mutation was executed through the observer. Trusted fixture
reload/restart/credential provisioning is separate from application capabilities.
The scoped Asterisk logger excludes authentication-identifier notice messages;
application logs contain safe system/node/incarnation/epoch/correlation fields.

Development settings are exactly: freshness 30s; snapshot cadence 5s; lease 15s;
renewal 3s; database connect/statement/lock 2s each; DNS/TLS connect/login/query
2s each; complete snapshot deadline 8s; four concurrent node sessions/one snapshot
per node; retry 1/2/4/8/10s maximum while active; shutdown drain 5s; credential
reconnect ceiling 60s; frame 16KiB; snapshot 1MiB; 1,000 endpoints/4,000 contacts.
Settings and relationships validate before startup. These are not production
capacity, availability, HA or recovery targets.

Explicit injected profiles: protocol tests use 40ms queries/100ms snapshot deadline
(and 1,000ms for the cancellation case). Synthetic engine tests use lease 150ms,
renewal 30ms, database 10ms, snapshot 80ms, I/O 20ms, cadence 10ms, freshness 100ms,
drain 100ms, retry ceiling 20ms and credential rotation 30ms. Other caps retain
approved values. Trusted database fixture expiry accelerates takeover/transport
recovery; the no-observer 30-second freshness expiry uses actual elapsed time.

## Acceptance coverage

| ID   | Result and boundary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B-01 | Pass: adapter/session/store/ownership ports, fixed action capabilities, ordering, freshness, grants, isolated composition and P3-U5 handoff documented. G-01–03 conditionally approved/provisioned for this development installation. Real denied-class probes passed; broader `system` permission explicitly retained.                                                                                                                                                                                                                                                                                                                                           |
| B-02 | Pass, real controlled Asterisk: certificate-verified authentication, genuinely empty snapshot, configured unregistered endpoint and authenticated SIP registration are distinct from invalid-auth/secret-missing states. Desired registry version/settings remain unchanged during observation.                                                                                                                                                                                                                                                                                                                                                                   |
| B-03 | Pass, real PostgreSQL and independent processes: one winner per canonical node, conditional renewal/expiry/takeover/release, durable increasing epochs across reacquisition/release, and ownership of a separate canonical node. The second target is synthetic: database ownership/isolation evidence, not live multi-PBX observation.                                                                                                                                                                                                                                                                                                                           |
| B-04 | Pass: SIGSTOP/barrier-delayed old tokens reject writes, callbacks, intent creation and historical-intent consumer application after takeover; old release cannot release successor. Actual HTTP connectivity edits invalidate ownership/current observations atomically. Name-only edits preserve epoch and requalify version. Audit/invalidation failure rolls back desired/version/ownership changes. A callback spanning expiry and locally cancelled receipt both roll back their already-started intent write. Duplicate/older/gapped sequences reject. Synthetic discovery/edit race refuses an old descriptor paired with a newer token before connection. |
| B-05 | Pass: injected renewal response uncertainty and persistent database-failure controls cancel work/publication. Real PostgreSQL COMMIT response loss proves ambiguous renewal; real TCP interruption blocks publication and restores a newer reconciled epoch. Actual shipping A/B processes start without listeners, reconcile and drain successfully within 5 seconds. Local cancellation is checked inside the publication transaction even while its database epoch remains valid.                                                                                                                                                                              |
| B-06 | Pass: real Asterisk restart/disconnect/reconnect and independent owner restart/failover reconcile; complete snapshots remove obsolete fixture facts and permit empty data. Actual freshness expires after 30s without an observer. Injected framing tests cover old ActionIDs, duplicates, gaps, events during acquisition, partial lists, overflow and timeout; failed snapshots preserve historical facts.                                                                                                                                                                                                                                                      |
| B-07 | Pass: actual controlled account rotation and fresh protected-file reconnect, finite lookup failures, approved destination checks and private access. Credential/raw contact URI/auth-name/call-ID/user-agent sentinels are absent from adapter results, projections, intents, safe application diagnostics and DTOs. Registrations remain unmapped; no inventory/tenant/voice-readiness attribution is created.                                                                                                                                                                                                                                                   |
| B-08 | Pass: bounded parser/I/O/cancellation/resource checks, synthetic four-session/concurrency and per-node failure isolation, real shipping process drain, and HTTP/worker isolation. Runtime exposes no mutating or arbitrary PBX operation; future external write fencing remains P3-U5.                                                                                                                                                                                                                                                                                                                                                                            |
| B-09 | Pass: focused real-PBX/multi-process acceptance, registry regressions, affected durable/process checks and full `./dev check` exit 0. Contract/runbook/evidence/index/tracker reconciled with exact settings, cleanup and c/P3-U5 limits.                                                                                                                                                                                                                                                                                                                                                                                                                         |

## Commands and results

Executed from the repository host through Docker:

- `./dev pbx-observation-prepare` — pass; protected observer/trust provisioning,
  controlled Asterisk activation and address refresh; permanent UUID preserved.
- `./dev telephony-up 2` and `./dev migrate` — pass; approved development process
  composition and twelve migration versions installed. A follow-up grants migration
  preserves already-applied history while hardening immutable epoch keys/columns.
- `./dev exec pnpm check:pbx-nodes --observation` — final focused run exit 0.
  Real-PBX evidence and fault evidence are labeled separately in its output.
- `./dev exec pnpm check:pbx-nodes --registry` — A-01–07 and A/B HTTP diagnostics
  pass; protected registry/ports/idempotency/version/audit regressions retained.
- `./dev exec pnpm check:durability` — pass: actual transactions/outbox, independent
  workers, interruption/restart/recovery and bounded drain.
- `./dev exec pnpm check:entrypoints` — pass: HTTP/deployment independence,
  unconfigured worker/telephony finite failure without listeners. Actual configured
  telephony entry points are additionally exercised by the observation suite.
- `./dev exec pnpm check:identity-foundation` — normalization/storage/authority/
  bootstrap checks pass after expected migration count changed from ten to twelve.
- Focused lint/typecheck and protocol/engine fault checks — pass.
- Final `./dev check` — pass, exit 0, 2026-10-14 17:44 +08:00. Includes lint/format/typecheck/all builds, entrypoints/config, database/durability/storage/identity/bootstrap, client secret exclusion, storage deployment, shared session/authority/admission/recovery, platform/draft/staff/credential HTTP/browser and PBX registry regressions.

Intermediate failures were corrected before final focused acceptance: upstream
empty-list error responses required exact adapter recognition; the SIP fixture's
UDP connect/disconnect reset its response path; fresh-port deregistration needed
an authenticated wildcard contact for the fixture AOR; excessive fixture polling
hit normal HTTP admission; shortened session fixtures expired during long passive
checks; persistent renewal-failure injection needed to withhold fresh authority;
a synthetic frame builder accidentally overwrote its old ActionID. Full-graph
findings were the empty mask directory's traversal mode and legacy migration-count
assertions. A subsequent full-graph bootstrap race failed while development
HTTPS builders were running; the focused identity/bootstrap suite passed unchanged,
and a sequential full-graph rerun passed that race. Its browser stage then found
the Playwright cache missing after workspace recreation; the existing locked
Chromium browser/system dependencies were restored using CI commands before
the final graph rerun. That run then hit an existing staff logout-retry login
fixture timeout; focused browser acceptance passed unchanged. The fixture now
foregrounds the document and waits for network/form readiness before entering
protected values, avoiding a race with intentional visibility-change password
clearing. Application behavior and test timeouts are unchanged. None authorizes weakened runtime limits or simulated live completion.

## Precise fixture cleanup and retained installation

Final focused run used database `myims_session_e549f8992e57`, Redis container/volume
`myims-session-check-22db775028ea` and endpoint/auth/AOR
`myims-observation-73a85d1e`. Previous successful cancellation/rotation run used
`myims_session_b8a715a13cd2`, `myims-session-check-dd9304bb4c57` and
`myims-observation-248606e6`. Each launcher removes only its exact named Redis
container/volume and temporary directory; the database harness drops its exact
uniquely named database and closes proxies/children.

SIP REGISTER clients close sockets on completion; authenticated expiry-zero
wildcard REGISTER removes only the fixture AOR's contacts. The launcher restores
the controlled observer credential, clears/reloads/removes the exact temporary
`/tmp/myims-pbx-fixture.conf`, and removes fixture-only processes/private mode-0600
files. Failed-run Redis fixture `myims-session-check-88194b0d22bf` was identified
by creation time and explicitly removed after its early teardown error.
No broad container/volume/database cleanup was used. Final independent checks
returned zero exact named databases/Redis containers, `No objects found` for
Asterisk endpoints and contacts, and absence of the exact temporary fixture file.
The database check used the configured local `myims` role after a first read-only
probe found that the default `postgres` role does not exist.

Preserved: the existing installation UUID/catalog, intentionally installed
ignored observer/development trust files and marker, normal shared-service volumes,
existing tenant/operator data and two approved local development telephony containers.
No product extension inventory, tenant configuration/route or operational call
was created or changed. The workspace's empty tmpfs mask hides host PBX material;
backend/ordinary worker mounts omit it. Server private key/account mounts are
Asterisk-only; observer credential/CA mounts are telephony-only. Development HTTPS
supervisors stopped by the initial workspace recreation were restored; platform
and staff status both report ready. Final backend live/ready checks return HTTP
200 and both normal telephony containers are running. Existing private material/ports were retained.

## Handoff limits

c receives the tested passive `PbxObservationDto`, current/stale/historical/unknown
semantics, safe failures, exact settings and fixtures/recovery commands. Browser
list/register/detail/edit delivery and integrated parent acceptance remain c.
P3-U5 receives lease/epoch/conditional publication contracts, but must enforce
stale epochs at the external PBX write boundary, ordered revisions and active-call
policy before live apply. A pre-call database check cannot revoke an issued
command. No live apply/control safety is extrapolated from these read-only tests.

Only one real controlled installation was tested. Synthetic second-target
ownership/isolation is not live independent-target or production HA evidence.
Production deployment, permission model/secrets management/capacity/limits,
monitoring/recovery and PBX-side enforcement remain separately unapproved.
