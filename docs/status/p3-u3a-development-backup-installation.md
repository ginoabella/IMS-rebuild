# P3-U3a — Approved development storage installation checkpoint

2026-10-21 (Asia/Manila, +08:00). The owner approved the recommendation and
[development installation request](../planning/p3-u3a-development-backup-installation-request.md),
then selected **a host administrator runs the installer**. This authorizes the
bounded development host/storage setup; it does not waive the request's separate
OpenBao installer/snapshot-identity, backup-first, independent key custody,
retained restore, cleanup or production gates. Keep `platform-owner-custodian`
unchanged. P3-U3a remains incomplete.

## Actual retained changes and host handoff

Verified all previously reviewed source hashes and the tested tooling image ID.
Initially created only the exact persistent Docker volume
`myims-backup-development_repository`. The administrator subsequently created the
non-login account (UID/GID 12010), approved `/srv` service paths and isolated
Rest Server. Independent read-only verification now confirms running TLS with
CA/hostname validation, authenticated access, anonymous/other-repository denial,
internal-only networking, no host ports, protected read-only auth/TLS mounts,
read-only root, dropped capabilities, no-new-privileges and `restart: no`.
The repository remains uninitialized and the probe performed zero repository
writes. Transport credentials work; independent repository credential escrow,
SMTP credential validity and recovery custody are not thereby verified.
No scheduler, real backup capture, pruning or restore has been activated.
[Machine verification](p3-u3a-development-storage-verification.json).

The host has approximately 14.3 GiB available on the shared root/Docker filesystem.
The earlier conservative 91.5-GiB snapshot-input estimate plus audit/overhead cannot
fit here. The installer therefore caps the controlled pilot repository at **2 GiB**;
this is a stop limit, not accepted 30-day/monthly retention capacity. Retention
readiness requires measured growth and adequate storage; timed COMPLIANCE remains
a deferred enhancement, not a blocker.

The current `gino` session has Docker access but `sudo -n true` requires interactive
authentication. No password was requested/read and no attempt was made to bypass
host authentication through a container mount of host administration files. The
owner selected administrator execution rather than a `.local`/existing-UID change.

Prepared [root-only host installer](../../scripts/backup-host/prepare-development-host.py).
Its default mode performs read-only preflight; `--install` refuses a non-root
caller before mutations. The plan selects an unused service UID/GID, initially
12010, and rejects target collisions, changed reviewed source/image or insufficient
pilot headroom. It creates a non-login account and `/srv/myims-backup-development`,
protected transport/repository credential files, a dedicated development CA/TLS
certificate and non-secret configuration. Password hashing reads stdin; no secret
is placed in argv/environment/output. It changes ownership only of the reviewed
empty volume, starts only `rest-server`, and runs a read-only TLS/authentication
probe. It records partial/completed installation metadata without secrets.

The following approved installation handoff has now been performed. **Do not rerun
it on the installed target**; the installer intentionally rejects existing paths.
Its recorded command was:

```sh
sudo python3 /home/gino/projects/IMS-rebuild/scripts/backup-host/prepare-development-host.py --install
```

For the installed storage stage, use the read-only check instead:

```sh
python3 scripts/backup-host/verify-development-storage.py
```

The current chat session still lacks noninteractive sudo; it did not create host
accounts/credentials or read the administrator's SMTP password. On any uncertain
installation outcome preserve its stage/result and owned artifacts for exact
reconciliation, rather than blindly rerunning or deleting existing account/storage.

The installer deliberately does not initialize the repository, create an age
private identity, discover a real provider/audit mount, access OpenBao, install a
timer, send email, prune or restore anything. The absent
`pending-audit-source` path prevents treating a placeholder as a verified source.
Repository initialization still requires independently recoverable credential
custody. Snapshot/archive jobs additionally require the public age recipient and
separately established native capture route. The independently observed installed state is verified; this does not establish
backup readiness or satisfaction of the remaining OpenBao/custody gates.

## Authorized installer and backup-operator reference check

The owner requested help checking existing references. Checked non-secret
repository records, the exact named host jobs and backup-related container names;
no new OpenBao login, provider inventory, credential search or custody access.

| Candidate/reference | Evidence and disposition |
| --- | --- |
| `gino` host session | Docker group membership permits the approved Docker volume action. Interactive sudo authentication is unavailable to this session. Host authority does not establish OpenBao installation authority. |
| `platform-owner-custodian` | Existing accepted ten-path capability evidence records `deny` for native snapshot GET and the deployment-maintainer policy. Its two verification sessions were revoked/403 and consumed. Keep it unchanged; do not reuse those authorizations. |
| Existing backup job/operator | `myims-openbao-backup.timer`, `myims-openbao-backup.service`, `myims-backup-development.service`, `restic.service`, `rest-server.service` all report `LoadState=not-found`. No backup/Restic container existed at inspection. This does not rule out another external or differently named authorized mechanism. |
| `platform-raft-snapshot-reader`, `platform-backup-maintainer` | Proposed in reviewed manifests and exercised only where disposable evidence says so. No accepted retained provisioning/current authority is established by those names. |
| Earlier root recovery | Historical operation completed and recovered root was revoked. It is not an available installer credential or permission to repeat recovery. |

Conclusion: **an existing independently authorized OpenBao installer and backup
route are still not established by the inspected evidence**. This is not proof
that none exists. A named operator/approved route and its independent authority
record are needed before protected current verification or privileged provisioning.
The existing custodian's permitted metadata reads would not themselves confer
snapshot/provisioning rights. No new root operation or backup-first exception is
included in this installation approval.

## Email and independent custody

The owner replaced the earlier address with **itsg.notification@sscgi.com** and
provided SMTP host **smtp.office365.com**, port **587**. Use verified STARTTLS;
this mailbox is the login/sender and the requested replacement recipient. The
password stays in `/srv/myims-backup-development/notification/smtp.password`,
root-owned 0600 in a root-only directory; never in source, argv, environment or
chat. The installer creates an empty file, so sending fails until configured.
After the administrator runs the installation command above, enter only the
password (one line, no variable assignment/quotes) using:

```sh
sudoedit /srv/myims-backup-development/notification/smtp.password
```

Non-secret settings live in `/srv/myims-backup-development/alert-configuration.json`.
[SMTP alert helper](../../scripts/backup-host/send-alert.py) defaults to local
configuration validation, with no network connection. Its `--send` mode is an
explicit operator action; no supervisor is installed and no email has been sent.
Seven synthetic tests verify certificate/hostname checks and STARTTLS-before-login,
no credentials after TLS failure, no message after authentication failure,
recipient rejection and no automatic retry after uncertain delivery. These tests
use no real SMTP connection, mailbox credentials or messages.

Microsoft documents this host/port with TLS 1.2/1.3 and requires SMTP AUTH to be
available for the mailbox. Password authentication may be blocked by tenant policy;
we will not disable security defaults or change the Microsoft tenant. If blocked,
review OAuth or an approved relay separately. [Microsoft submission guidance](https://learn.microsoft.com/en-us/Exchange/mail-flow-best-practices/how-to-set-up-a-multifunction-device-or-application-to-send-email-using-microsoft-365-or-office-365).
A credential-free network probe now verifies port 587 reachability, certificate/
hostname-validated STARTTLS negotiated as TLS 1.3 and advertised AUTH. This does
not authenticate the mailbox. [Network evidence](p3-u3a-smtp-connectivity.json).
The tenant configuration, password and actual delivery/receipt remain unverified.
The administrator can first validate the protected local configuration without a
network connection:

```sh
sudo python3 /home/gino/projects/IMS-rebuild/scripts/backup-host/send-alert.py
```

After successful validation, an explicitly labeled delivery test is available:

```sh
sudo python3 /home/gino/projects/IMS-rebuild/scripts/backup-host/send-alert.py --send --event notification_test
```

`--send` without a stated event refuses before reading credentials or connecting.
No message has been sent by this session. The SMTP password remains root-only;
we have not tried to bypass host authentication to read it.

The owner has supplied a validated public age recipient (see the latest checkpoint
below); confirmation of independently held private-key copies is still missing. Do not generate a private archive identity
on the backup/source host as a substitute for independent custody. OpenBao seal
custody remains separate. Source/scheduler/rotation/housekeeping and joint native
OpenBao/PostgreSQL recovery acceptance, including generation reconciliation and
measured RPO/RTO, remain outstanding. Native renewal HTTP 500, expiry timing,
retained lifetime-policy and browser-recovery findings are preserved.

## Verification of this handoff

The administrator-run storage installation is now independently verified, including
service isolation and authenticated TLS. The earlier handoff's nonmutating plan
passed against the approved empty volume/tooling image, and non-root `--install`
refused before mutations. Python syntax and scoped
Node lint/format passed. The read-only host-installation probe passed within the
complete **33/33** disposable TLS/Compose/native restoration run
[057973f8](p3-u3a-disposable-runs/057973f8-872b-4faf-be14-36835e4942fb.json),
with exact container/network/volume/private-work cleanup verified. A subsequent
synthetic malformed-credential probe also confirmed sanitized failure output. The
root-only account/directory/TLS/startup phase is reflected by the independently
observed installed state. The root-only completed-status file was not read through
an alternative privilege route. No real backup or restore readiness is inferred.

## Administrator SMTP configuration result — October 21

The owner reported the administrator command returned `status=passed`,
`configurationValid=true`, `messageSubmitted=false`,
`mailboxDeliveryVerified=false`, and `automaticRetry=false`. This is accepted as
owner-reported local configuration/password-file validation. No credential was
shared or read by the agent. It does not prove Microsoft 365 authentication or
mail submission/delivery; the explicit `notification_test` remains the next check.


## SMTP delivery failure and safe diagnosis — October 21 (UTC)

The administrator reported a failed `notification_test` with legacy stage
`smtp_delivery`, submission unconfirmed and no automatic retry. The earlier
configuration pass still stands; neither authentication nor delivery is proven.
The helper previously hid all error details and was silent during network work.
It now flushes stage progress and reports a safe failure classification and numeric
SMTP response code, without server reply text, passwords or exception text.
Existing 15-second socket timeouts apply per operation, not to the whole command.

Before another submission, run the authentication-only diagnostic:

```bash
sudo python3 /home/gino/projects/IMS-rebuild/scripts/backup-host/send-alert.py --check-smtp
```

This verifies TLS and authentication without sending MAIL, RCPT or DATA. Share
only its JSON output. An authentication-only pass does not verify delivery.
Do not automatically repeat the uncertain earlier submission; check the inbox
and use the diagnostic result to resolve the failure first. Submission failures
remain uncertain; a later QUIT failure preserves confirmed server acceptance.
Eleven synthetic tests passed, including authentication-only no-send, redaction,
authentication rejection, submission timeout and post-acceptance disconnect.
No agent SMTP authentication, email submission or password read occurred.


Administrator-reported `--check-smtp` result (2026-10-21 UTC): connection, EHLO,
STARTTLS and post-TLS EHLO passed; authentication rejected with numeric SMTP 535.
This diagnostic submitted no email. The code alone does not distinguish wrong
credentials from account/mailbox/tenant authentication restrictions. Request the
Microsoft 365 administrator's read-only review of the account's Entra sign-in
failure and SMTP AUTH/authentication policy settings before choosing remediation.
Do not disable tenant security defaults or MFA for this helper; if password SMTP
is prohibited, prepare OAuth or an approved relay separately. Earlier uncertain
submission remains historically uncertain.


Latest administrator-reported `--check-smtp` (2026-10-21 UTC) passed connection,
verified TLS, authentication and disconnect: `smtpAuthenticationVerified=true`,
`messageSubmitted=false`, `mailboxDeliveryVerified=false`. This supersedes the
authentication blocker for this observed attempt; the earlier 535 remains
historical and its cause is unconfirmed. No password or tenant policy change is
inferred. Next, the administrator can submit one labeled `notification_test`
and confirm inbox/junk-folder receipt; submission alone does not prove delivery.
No agent credential read or SMTP request occurred.


Latest administrator-reported `notification_test` (2026-10-21 UTC) passed
authentication, submission and QUIT (`messageSubmitted=true`). The recipient
reports no message yet; mailbox delivery remains unverified and alerting
acceptance remains open. Preserve earlier failure evidence. Check the receiving
mailbox's folders and then Exchange Online message trace for sender/recipient
`itsg.notification@sscgi.com` and subject
`MyIMS development backup: notification_test` around the test time before
submitting another test. No agent mail submission or mailbox access occurred.


Owner-provided Exchange message trace screenshot confirms **Delivered** for
`MyIMS development backup: notification_test`, sender and recipient
`itsg.notification@sscgi.com`, at **2026-10-21 11:12 UTC+08:00**. This verifies
Exchange-reported delivery for the manual test; owner inbox visibility remains
unconfirmed. Earlier submission/authentication failures remain historical.
Automatic backup alert triggering, scheduling and operational monitoring remain
unverified; this result does not activate them or complete P3-U3a.


Owner confirmed receipt of the `notification_test` in their inbox (2026-10-21
UTC). Manual SMTP delivery acceptance is now verified through local configuration,
verified TLS/authentication, successful submission, Exchange Delivered trace and
owner inbox confirmation. Automatic backup-event integration, scheduling and
operational monitoring remain pending; P3-U3a remains incomplete.


## Owner age recipient handoff — October 21 (UTC)

Owner supplied the public recipient recorded in
[development-age-recipient.txt](../../infra/backup/development-age-recipient.txt).
Pinned age tooling accepted it and encrypted empty disposable input to `/dev/null`
in a network-isolated, read-only container with no host mounts or private keys.
This validates the recipient encoding/encryption path, not possession of its
private key or independently recoverable custody. Host installation is pending.

Administrator installation (public key only):

```bash
sudo install -o root -g myims-backup-development -m 0440 /home/gino/projects/IMS-rebuild/infra/backup/development-age-recipient.txt /srv/myims-backup-development/public/recipient.txt
```

Confirm protected private-key recovery copies are independently held outside
MyIMS/backup host mounts. Keep OpenBao seal/recovery custody separate. No repository
initialization, retained capture, private-key handling or OpenBao access occurred.


## Approved authority metadata review — October 21 (UTC)

The separately approved names-only review completed; [findings and exact limits](p3-u3a-authority-metadata-review.md). One custodian session, three metadata queries, acknowledged revocation and 403 confirmed. Approval consumed. No independently usable installer or native backup route was established; further reads, provisioning, bootstrap exceptions and recovery remain separately gated.
