# P3-U1b local observation policy review

Prepared 2026-10-14 (Asia/Manila, +08:00). **Conditionally approved 2026-10-14 (Asia/Manila, +08:00), development only.**
Requirement: [P3-U1b](../../context/feature-specs/p3-u1b-fenced-asterisk-observation-and-recovery.md),
B-01–09 and parent G-01–03. Existing
[a approval](p3-u1a-connectivity-contract-review.md) establishes target identity,
AMI-TLS descriptor and protected-file provider, but explicitly leaves authenticated
access, permissions, rotation and observation policy to b.

## 1. Approved scoped local policy

The user approved this section for provisioning and testing the existing
controlled Compose target under the settings below. These are development
settings, not production capacity, availability or recovery promises.

| Gate | Proposed decision |
| --- | --- |
| G-01 target | Retain the existing Asterisk 22.10.1 installation UUID/catalog. Enable certificate-verified AMI-TLS on private port 5039 with service name `asterisk`; publish no management port. Bind plaintext AMI to container loopback only and never use it from the adapter. Keep HTTP/ARI disabled. Validate and pin catalog-approved addresses on every connection. |
| G-01 permissions | Dedicated observer account with the minimum upstream action class needed for the two PJSIP list actions (`write=system`), no other write classes, and registration-only event delivery. The application exposes only Login, Logoff, Ping, PJSIPShowEndpoints and PJSIPShowContacts. Account permissions are broader than this application allowlist; see the explicit limitation below. |
| G-01 registration coverage | Observe PJSIP endpoint/contact presence and contact status only. Dynamic contact presence indicates an observed registration; contact reachability remains a separate fact. Static contacts cannot establish dynamic registration. Exclude chan_sip, outbound trunk registrations, caller/channel facts, addresses, contact URIs, user agents, authentication names and raw events from storage/DTOs. Unsupported facts remain unknown. |
| G-01 fixtures | Allow temporary uniquely named PJSIP endpoints/AORs and private SIP REGISTER clients on this controlled bootstrap target, with no dialplan access or calls. Exercise registered, unregistered and genuinely empty snapshots. Remove exact fixture sections, contacts and clients afterwards. Existing tenant routes/inventory remain outside the fixture. A synthetic second target proves ownership/isolation only; live independent-target evidence requires a separately authorized second installation. |
| G-02 material | Provision random observer credentials and a private development TLS CA/leaf through ignored owner-only files under `.local/pbx-observation`. Keep the catalog non-secret. Only the telephony process mounts the observer credential and CA; Asterisk mounts its own account/server key. HTTP, ordinary workers and web apps receive neither credential nor private key. |
| G-02 rotation | Trusted provisioning atomically replaces the protected credential file and updates the controlled Asterisk account. Runtime rereads credentials on each connect and forces reconnect at most every 60 seconds, with immediate reconnect after authentication failure. No retained credential fallback. Keep installation identity stable. Missing/inaccessible material remains a safe finite failure state until a subsequent bounded attempt can resolve it. |

The pinned runtime's read-only command introspection confirms both list actions
require `system`. Its upstream source also assigns that class to mutating actions.
Consequently an upstream AMI account with these grants is **not a strictly
read-only security principal**. The proposed boundary is a code-owned action
allowlist and least available upstream classes on the isolated development target.
No arbitrary action parameter, CLI, originate, reload or configuration operation
is exposed by b. Denied-action tests can prove missing `command`, `config` and
`originate` classes; they cannot honestly prove denial of every mutation in
`system`. No mutating permission probe may actually execute a PBX mutation.

The user explicitly acknowledged this limitation in the conditional approval.
If a strictly read-only account is required, do not grant `system` and do not
claim G-01 resolved: first approve a separate enforcement design/controlled
Asterisk build that restricts actions at the PBX boundary. This proposal does not
silently authorize a new proxy service, third-party patch or weakened TLS.

Primary references: pinned
[PJSIP endpoint action registration](https://github.com/asterisk/asterisk/blob/22.10.1/res/res_pjsip/pjsip_configuration.c),
[contact action registration](https://github.com/asterisk/asterisk/blob/22.10.1/res/res_pjsip/pjsip_options.c),
[manager action registrations](https://github.com/asterisk/asterisk/blob/22.10.1/main/manager.c),
and [manager configuration sample](https://github.com/asterisk/asterisk/blob/22.10.1/configs/samples/manager.conf.sample).
Live authentication and denied-action evidence remain outstanding.

### Approved development G-03 settings

| Setting | Local value |
| --- | --- |
| Freshness threshold | 30 seconds from last complete successful snapshot, using database time on passive reads |
| Snapshot cadence | Every 5 seconds while owned; full reconciliation on acquisition/reconnect/restart/failover |
| Lease duration / renewal | 15 seconds / every 3 seconds; expiry uses database time |
| Database connect / statement / lock bound | 2 seconds each; no transaction held during network I/O |
| DNS / TLS connect / login / each list query | 2 seconds each; complete snapshot deadline 8 seconds |
| Concurrency | At most 4 active node sessions and 1 in-flight snapshot per node per process; bounded registry discovery pages |
| Retry | One attempt per cycle, exponential delay 1, 2, 4, 8, then 10 seconds maximum; no overlapping retry; retry while runtime is active |
| Stream/projection limits | 16 KiB per frame, 1 MiB per snapshot, 1,000 endpoints and 4,000 contacts; overflow is incomplete, never truncated healthy data |
| Shutdown drain | Cancel I/O immediately; at most 5 seconds for matching-generation release and resource close |
| Credential refresh/reconnect ceiling | 60 seconds; each reconnect requires a fresh complete snapshot |

Validate positive integer bounds and relationships before startup: renewal plus
bounded database round trip is shorter than lease duration; snapshot deadline is
shorter than lease duration; cadence plus snapshot deadline is shorter than
freshness; shutdown is bounded independently of query retries. A process-local
conservative expiry timer cancels work, while conditional database writes remain
the authority under stalls and uncertain renewals. Settings must not silently
change to obtain a test pass. Fault fixtures may use explicit isolated timing
profiles and must record them separately.

## 2. Implementation contract after gate resolution

These routine choices remain subordinate to section 1 and the feature spec.

- Serialize registry edit, acquisition, renewal and publication using the same
  registry → observation → lease transaction lock order. Preserve an epoch row
  across release; every reacquisition increments it. Name-only edits requalify
  desired version atomically; connectivity edits revoke ownership and current
  observation in the registry/audit transaction.
- Persist one bounded latest projection per canonical node. Keep last-known
  successful facts historical on failure; passive list/detail derives current
  freshness and ownership from database time, desired version and unexpired
  epoch. No observer or session renewal starts from reads.
- Subscribe only to registration-change notifications. Notifications invalidate
  a snapshot in flight and trigger a new complete snapshot; they never directly
  assert current registrations. Discard duplicate/older sequence updates and
  reconcile gaps. Match list response/completion ActionIDs and counts; incomplete
  or failed lists preserve prior facts as historical rather than replacing them
  with an empty set. Persistent event churn remains reconciling.
- A poller reads committed registry state to discover/reconcile work; no shipping
  realtime/queue consumer is needed for passive DTOs. Prove durable publication
  intent and delayed consumer fencing through a narrowly scoped non-shipping
  outbox fixture, including required-write rollback.
- Use system attribution with safe node/incarnation/epoch/correlation identifiers.
  Every callback/write/intent verifies desired version and current generation on
  its write transaction. Renewal uncertainty cancels local publication; reacquire
  and reconcile before resuming.
- Expose a narrow ownership port for P3-U5. A pre-call check cannot revoke an
  already issued external command; PBX-side fencing, revision ordering and
  active-call policy remain mandatory before live apply.

## 3. Verification and exact cleanup boundary

Establish `./dev exec pnpm check:pbx-nodes --observation` after implementation.
Use a uniquely named disposable PostgreSQL database under real runtime grants,
independent telephony A/B child processes, and a's protected HTTP boundary.
Track fixture IDs/paths/container names explicitly for teardown.

Map B-01–09 to real authenticated TLS snapshots; independent lease races;
barrier-delayed stale callbacks/intents/consumer writes; atomic edit/audit rollback;
renewal response loss/database interruption; cancellation/restart/drain;
real disconnect/reconnect plus separately labeled ordering faults; credential
failure/rotation/sentinel absence; cardinality/concurrency/per-node isolation;
and absence of an exposed mutating action. Live second-target checks remain
unverified unless a second authorized controlled installation is supplied.

Run a's registry checks, affected durable/process regressions and `./dev check`.
Retain sanitized results and commands in b's evidence/runbook, with c/P3-U5 limits.
Remove only fixture-owned database, private process controls, endpoint sections,
REGISTER clients/contacts and temporary acceptance credentials. Preserve the
installation UUID, existing tenant/operator state, source configurations and
persistent development trust/observer files intentionally installed by provisioning.
Record restoration and remaining installed files explicitly in evidence.

## 4. Preparation checkpoint (historical)

At preparation, only repository/service inspection and policy preparation had run. The existing
controlled Asterisk is healthy; AMI remains disabled in tracked bootstrap and the
telephony entry point remains a skeleton. No credential was read, no management
listener enabled, no registration fixture installed and no authenticated observation
or B-01–09 pass is claimed.

Preparation requested decision (resolved by section 5): approve section 1 for the isolated local target, explicitly
accepting the upstream `system` account limitation with the application read-only
allowlist, or require a strictly read-only PBX enforcement design before proceeding.
Approval also needs the listed local freshness/lease/rotation/fixture policy;
production operational policy remains separately unresolved.

## 5. Conditional approval and adapter constraint

The user approved G-01–03 for implementation and controlled acceptance on
2026-10-14, with these binding conditions: acknowledge the broader upstream
account; enforce the application action allowlist, private verified TLS and
protected credentials; keep a narrow replaceable observation adapter; confine
future production interface/security hardening primarily to that adapter and
provisioning; treat all settings as development only; remove isolated PJSIP
fixtures; document B-01–09 with real and injected evidence distinguished; expose
no protected PBX material to HTTP/web/ordinary workers/logs/DTOs; separately
review any expanded permissions, management exposure, control operations, security
boundary change or production deployment. Production secrets, HA/multi-PBX,
monitoring, capacity, recovery and PBX-side enforcement remain unapproved.

The application-owned `PbxObservationAdapter`/`PbxObservationSession` port returns
only bounded complete snapshots or finite failures. Its contract owns ordering
uncertainty, cancellation and close, with no protocol action argument. AMI
framing, TLS, credentials, response/event reconciliation and provisioning stay
in the adapter. Engine, SQL ownership, passive API DTOs and UI contain no AMI
commands or permission assumptions. Alternative adapters implement the same port;
core fencing/freshness logic is unchanged.
