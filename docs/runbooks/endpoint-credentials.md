# Private development endpoint provider

Status: P3-U2b B-01–07 complete for controlled private development;
[final acceptance evidence](../status/p3-u2b-evidence.md).
Scope is the [conditional approval](../planning/p3-u2b-credential-contract-review.md).

Use opt-in `infra/docker/compose.credentials.yaml` with the normal Compose project.
Preserve endpoint-secrets-data and endpoint-secrets-audit volumes during normal
stops. The server runs persistent Raft with verified TLS at endpoint-secrets:8200,
no published port, no UI, no dev mode. Runtime must never disable TLS verification.

Provisioning files belong under ignored owner-only `.local/endpoint-credentials`,
owned by dedicated UID/GID 1003 (distinct from host/workspace HTTP UID 1002):
server TLS key/certificate, separate CA custody, initialization/seal custody,
scoped administration and separate worker/cleanup runtime token files. Use trusted deployment containers as UID 1003 to access custody. A private copy
of the runtime database password is owned by 1003 for the credential worker. Mount only
the exact runtime files required by each process; never mount the custody directory
into HTTP, web, ordinary workers, observer or Asterisk. Initialization/unseal is an
explicit deployment action; applications must fail safely while sealed. Revoke
initial root after scoped administration is established. Development seal custody
is one share/threshold one; this is not production custody or recovery assurance.

Worker/cleanup tokens start with one-hour TTL and maximum 24-hour lifetime. Renew
before expiry; explicit trusted reprovisioning is required at maximum lifetime.
The scoped development administrator also expires after 24 hours. Run the trusted
`rotate-admin` helper before expiry: it creates an orphan successor, atomically
replaces the private token file and revokes its predecessor. Runtime tokens are
separate scoped orphans so administrator rotation preserves their bounded lease.
If administration has already expired, stop and use the separately controlled
seal-key recovery procedure; do not relax listener settings in application code.
Never print token/create/read responses, material, raw provider errors or bodies.
Provider audit retains default sensitive-value HMAC; do not enable raw logging.

Recovery must inspect canonical operation before any provider action; replay uses
the same operation/key/generation. Exhausted work requires audited deployment
reconciliation. Cleanup is explicit, exact installation/operation scoped, at most
50 terminal never-associated operations aged 24 hours; retain provider metadata.
No volume-wide/provider-wide deletion is permitted. Missing/uncertain dependencies
block destruction. Destruction does not establish backup/media erasure or live PBX
revocation. Associated generations remain retained for future P3-U5 dependencies.

Before production: separate review of HA, secure seal/key custody, tested joint
backup/restore, token lifecycle/automation, operational controls, worker access
scope, retention/retirement/destruction and live/rollback dependencies. Production,
phone delivery and PBX apply remain unapproved by this development contract.

Required acceptance: `./dev exec pnpm check:extension-inventory --credentials`,
`./dev endpoint-isolation-check`,
real PostgreSQL/runtime grants, Redis, HTTP A/B and OpenBao, security denial,
recovery/cleanup, inventory/auth/durable regressions and `./dev check`. Record
real versus injected checks and exact fixture cleanup before completion.

## Provisioning checkpoint and recovery gate — 2026-10-16

The private service is pinned to OpenBao 2.7.1, digest
`sha256:6d2b93856e3fcf7b18ad855a0b51eaba474dc8b79cf554379ea32034797d2acf`.
[OpenBao's audit advisory](https://github.com/openbao/openbao/security/advisories/GHSA-q74w-hv5x-6hxf)
identified the issue fixed by that release. Audit is declarative, as specified by
[OpenBao](https://openbao.org/docs/configuration/audit/); raw logging stays disabled.

Initial bootstrap created the administrator as a child; root self-revocation also
revoked that child. Provisioning now creates the administrator with `no_parent`
before revoking root. The user-approved isolated development recovery completed:
orphan scoped administration was restored, recovered root revoked, temporary
listener change removed, service restarted and manually unsealed. Scoped token
provisioning succeeds. B-01–07 acceptance subsequently passed.

Automatic approval review rejected temporarily enabling the unauthenticated
root-generation endpoint because it weakens a sensitive security boundary beyond
the explicit approval. The rejected command did not run. Normal listener settings
remain protected. Do not retry recovery without explicit approval of the exact
procedure: temporary isolated-provider recovery setting, restart/manual unseal,
seal-key quorum root recovery into owner-only memory/custody, orphan scoped admin
creation, root revocation, restoration of the protected listener setting, restart/
manual unseal and verification that unauthenticated root generation denies.
The user explicitly approved this isolated development recovery procedure on
2026-10-16 (Asia/Manila, +08:00). This does not authorize production or leave
unauthenticated root-generation endpoints enabled after recovery. Real verified-TLS
anonymous access to `sys/generate-root/attempt` returned 405 (disabled endpoint);
the HCL now explicitly sets `disable_unauthed_generate_root_endpoints = true`.

The `recover-bootstrap` deployment helper is not usable under normal protected
listener settings. Applications never invoke it. Provider acceptance, policy
scope/expiry/seal/restart and cleanup tests follow this recovery; record their
results separately from successful administration recovery.

Read-only process checks are in `scripts/check-endpoint-isolation.mjs`, executed
through the existing trusted Docker launcher environment. These checks confirmed
custody denial for HTTP/workspace-node/observer and anonymous provider denial;
they do not prove scoped worker/cleanup policy or successful material integration.
`./dev exec pnpm check:extension-inventory --credentials-api` checks only protected
HTTP/database intent behavior. Only `--credentials` is the required full unit suite.

Credential workers join only the provider and endpoint-database networks. PostgreSQL
joins the latter alongside its ordinary network; Asterisk/Redis/web/observer do not.
The credential worker therefore has database/provider connectivity without PBX or
ordinary application-network connectivity. Existing PostgreSQL can be attached to
this private network without recreating its container; do not interrupt ongoing
checks to apply a network declaration. Ordinary stops retain both provider volumes.

Repository formatting uses `scripts/format.mjs` to enumerate eligible Git files
before invoking Prettier. This avoids scanning ignored private custody directories;
material ownership/permissions remain restricted. Both tracked and new unignored
source files retain the existing Prettier parser and ignore configuration.

## Trusted development commands

The database bridge is explicitly external to Compose because trusted deployment
owns its lifecycle. It must still be an **internal Docker network**. For a fresh
development environment, create it once and attach the existing PostgreSQL
container with its private alias (skip either step when already present):

```sh
docker network create --internal myims-rebuild-dev_endpoint-database
docker network connect --alias postgres myims-rebuild-dev_endpoint-database myims-rebuild-dev-postgres-1
```

After owner provisioning of TLS files (SAN `endpoint-secrets`, verified against
`ca.crt`, private key mode 0600), custody UID/GID 1003 and volume ownership, start
only the provider with the additive Compose file:

```sh
docker compose -p myims-rebuild-dev -f infra/docker/compose.yaml -f infra/docker/compose.credentials.yaml up -d endpoint-secrets
```

Run the following from the repository root as a trusted Docker deployment owner;
replace `unseal` with `init` only for a genuinely fresh volume, then `bootstrap`
only while its protected initialization-root file exists. Never initialize over
retained data or delete custody to make a rerun pass.

```sh
docker run --rm --user 1003:1003 --network myims-rebuild-dev_endpoint-credentials \
  -v "$PWD/.local/endpoint-credentials:/custody" \
  -v "$PWD/scripts/provision-endpoint-credentials.mjs:/provision.mjs:ro" \
  node:22.23.3-bookworm-slim node /provision.mjs unseal
```

Verify both endpoint networks report `Internal=true` with
`./dev endpoint-isolation-check`. Do not recreate PostgreSQL merely to add this
bridge or use `--remove-orphans` against the retained observation services.

The same helper's `provision INSTALLATION_UUID` issues the two exact installation
runtime token files. Restart/reprovision the designated worker at token maximum
lifetime. Start it with `MYIMS_ENDPOINT_INSTALLATION_ID` set and Compose profile
`endpoint-credentials`; it mounts its worker token only, never cleanup/admin/seal
custody. Provider stop/restart leaves the server sealed until explicit unseal.

Before setup/reset, deploy a reviewed capability declaration for that exact
installation through the existing `declare-endpoint-capabilities` command. Advance
its revision and declare `credentialAuthMax` (at least 71) and `credentialHexMax`
(at least 64), alongside the existing format capabilities. Missing/insufficient
limits return `dependency_changed`; HTTP never infers support or changes the
declaration. This records approved desired-format compatibility, not live apply
or registration proof. See the [inventory deployment procedure](extension-inventory.md#deployment-and-capability-declaration).

The existing deployment entrypoint accepts `endpoint-credentials verify`,
`requeue`, `cleanup` or `cleanup-retry`, followed by the exact installation UUID
and 1–50 operation UUIDs. Supply runtime PostgreSQL configuration and only the
exact role token/CA through a trusted isolated deployment container. `verify`
uses worker access; `cleanup` uses cleanup access. `requeue` and `cleanup-retry`
need no provider token. `cleanup-retry` explicitly audits exhausted attempt
evidence before resetting the finite cleanup counter; subsequent `cleanup`
rechecks age, terminal non-association and dependency eligibility. It never
revives an operation or grants permission to destroy associated history.

Acceptance uses a unique installation namespace and disposable database. The
canonical database reserves every binding before any provider write. The trusted
test owner also retains safe reservation bindings under ignored
`.local/endpoint-fixtures/` before acknowledging fixture results. After the disposable
processes/database are removed, teardown destroys only those exact test-owned
versions and retains metadata. This fixture teardown is separate from application
retirement: test generations never reach a phone, revision consumer or live PBX.
An interrupted teardown retains the manifest for exact owner recovery. Never
apply this fixture mechanism to real retained generations.
