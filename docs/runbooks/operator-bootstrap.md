# Initial platform operator bootstrap

Bootstrap provisions the first tenantless platform operator. It does not sign in,
start a session, recover an account or create organizations/PBX resources.
Policy and implementation: [bootstrap contract](../architecture/canonical-operator-bootstrap.md).
Verification: [integrated evidence](../status/p2-u1c-evidence.md).

## Prerequisites

Use the trusted deployment workspace with Docker running, frozen dependencies and
built shared/backend packages. Run existing migration deployment first:

```sh
./dev migrate
```

The deployment workspace receives MIGRATION_DATABASE_URL and its optional password
file, plus DATABASE_URL using myims_runtime and its optional password file. Both
must point to the same migrated PostgreSQL database. The trusted role needs actual
operator/provenance INSERT and transaction/audit privileges. Runtime HTTP credentials
alone cannot bootstrap. Keep admin credentials out of runtime/client containers.

Migration/startup create no operator by themselves. The bootstrap launcher rebuilds
the backend but never migrates, starts HTTP or workers, or contacts PBX services.
Run only after confirming the deployment points at the intended database.

## Hidden interactive creation

From a terminal at the repository root:

```sh
./dev bootstrap-operator
```

Enter the username, password and identical confirmation at the hidden prompts.
Neither username nor password is echoed. Each prompt has a 120-second deadline.
Ctrl+C/Ctrl+D cancel; the command restores terminal mode and exits nonzero.

The username uses the approved ASCII normalization/validation contract. Choose a
unique password with 15–128 Unicode code points and at most 512 UTF-8 bytes.
Spaces and Unicode are allowed; no character mixture is required. Leading/trailing
spaces and Unicode forms matter. NUL, malformed UTF-8 and line-break characters
are rejected. Retain the password through your approved secret-handling process;
the command does not generate or deliver one.

## Protected automation input

Have trusted secret-management tooling supply a UTF-8 JSON file inside the
workspace container, for example at the following path. It must contain exactly
two string fields, username and password. Do not build its contents using shell
arguments, shell history, committed configuration or a printed example.

```sh
./dev bootstrap-operator --secret-file /tmp/myims-operator-bootstrap.json
```

The path is metadata; file contents are secret. Require ownership by the effective
workspace user and mode 0600 or stricter, a regular file with no symlink, and at
most 4096 bytes. The password policy applies to decoded characters/UTF-8 bytes.
Unpaired JSON surrogates and unexpected fields fail. Do not include a line break
inside the password; a trailing JSON-format newline outside the string is allowed.

The path is inside the container, not the host's /tmp directory. Use a private
container-local staging directory or an explicitly protected mounted secret path.
The existing ./dev launcher executes as the workspace node user; ensure the file
owner matches that UID. A host bind-mounted file must preserve those ownership
and permission checks. No new default secret mount or committed setting is required.

Bootstrap clears transient buffers where practical and closes the file. It leaves
operator-managed input unchanged. The supplying automation must remove its exact
transient file/staging directory after use, including on failure, or retain an
intentional secret source under its own policy. Do not use broad directory deletion.
There is no guarantee of complete plaintext erasure from memory/filesystem backups.

## Outcomes and matching rerun

The final JSON outcome contains the command, deployment entry point, a fixed state
and a correlation reference. It contains no username, password, hash or database URL.

| State           | Exit | Meaning and action                                                                                            |
| --------------- | ---- | ------------------------------------------------------------------------------------------------------------- |
| created         | 0    | One active/ready operator, credential, provenance and system audit committed together                         |
| already-created | 0    | Matching eligible initial operator exists; nothing was overwritten                                            |
| invalid-input   | 1    | Invalid policy, confirmation, input mode/file or terminal input; correct protected input                      |
| conflict        | 1    | Requested identity/provenance/account is incompatible; inspect canonical state through trusted administration |
| failed          | 1    | Settings/schema/access or a precommit operation failed; check prerequisites and rerun safely                  |
| uncertain       | 1    | Commit may have succeeded; rerun against the same database and identity to resolve durable provenance         |

Rerun the same explicit command with the same normalized username. Input policy
is validated again; even a different valid supplied password does not change the
existing credential, authenticate the operator or verify that new password.
The original password remains the credential. There is no reset flag.

A different requested initial identity, unrelated account using that username,
conflicting provenance or an ineligible existing bootstrap account fails. Do not
change/delete provenance, create a second bootstrap account, enable an account or
rotate a hash to bypass that result. Recovery requires its own later approved
procedure; this unit provides no operator recovery command.

## Interruption and safe diagnostics

If the process or database connection fails before commit, PostgreSQL rolls back
uncommitted creation. If a response is lost during commit, the account may already
be durable. A killed process may emit no result; treat the outcome as unknown.
Restore database access, keep the original credential available, and rerun the
same identity. Durable provenance determines created versus already-created.
Never interpret missing output or a failed transport as proof of rollback.

Use correlation references, fixed outcomes, schema history, role grants and
PostgreSQL service health for diagnostics. A trusted maintainer may inspect
provenance operator UUID/command and account status/credential state/versions.
Avoid SELECT * or dumping username/password_hash columns, secret files, connection
URLs, input transcripts or exception details into logs, tickets or published evidence.
Audit metadata is allowlisted and contains no credential material.

## Verification and disposable fixture teardown

```sh
./dev exec pnpm check:identity-foundation
./dev exec pnpm check:identity-foundation --bootstrap
./dev check
```

The default/--bootstrap selection runs storage and authority regressions plus c;
--storage and --authority retain their earlier focused boundaries. c creates a
uniquely named myims_bootstrap_ disposable database, supplies synthetic credentials
through protected files/PTYs, and invokes actual commands in independent processes.
It uses lock barriers, process/connection termination, forced audit rejection and
a test-only PostgreSQL protocol proxy that drops a real COMMIT completion response.
The production command contains no test interruption switches or fixture endpoint.

Fixture administration closes its resources and drops only its generated database,
then removes its exact private /tmp staging directory. If the fixture itself is
forcibly killed, independently verify the exact generated database/directory and
suite provenance before removing those disposable resources. Never drop the
operational database or run wildcard cleanup. Historical fixture audits remain
until that uniquely identified disposable database is removed.

These checks establish canonical identity/bootstrap behavior. Sign-in, sessions,
native mobile login, two-replica session revocation, real organization/PBX
provisioning, hosted CI execution and production readiness are separate acceptance.
