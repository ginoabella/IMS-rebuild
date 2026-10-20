# P3-U3a custodian handoff compatibility follow-up

2026-10-20 (Asia/Manila, +08:00). Source: owner's **Custodian Password Handoff
and Capability Verification Follow-up**. No credential change was authorized or made.

## Identified incompatibility and compatible correction

The prior helpers read up to 128 raw file bytes, decoded them as UTF-8 and required
`^[A-Za-z0-9_-]{43,128}$`. The intended credential is 43–128 ASCII letters, digits,
underscore or hyphen. This excludes file line-ending framing from the credential.
The [October 19 execution record](p3-u3a-recovery-execution.md#fresh-password-custody-confirmed-and-operation-executed)
explicitly documents omitting one final line ending from the maintenance copy while
preserving the original handoff. The current helper omitted that parsing step.
The preceding review missed this recorded compatibility requirement.

No exact original generator command is reconstructed or assumed. The approved
procedure records a freshly generated random password and separate personal
custody; synthetic base64url random inputs exercise its compatible representation.
A network-disabled, read-only diagnostic of the exact named protected handoff
confirmed **single final line-ending framing only**, valid credential format and
unchanged source bytes. No password, length, digest or other sensitive derived
value was printed or retained. No alternative credential source was searched.

The smallest compatible correction is a shared file parser accepting the raw
credential or one LF/CRLF terminator. It validates the credential's same 43–128
ASCII alphabet and length, with a 130-byte file ceiling to accommodate framing.
It rejects bare CR, repeated/embedded newlines, spaces/tabs, NUL, BOM, non-ASCII,
padding and short/long payloads. It never uses `trim`, rewrites the file, replaces
credential bytes or changes the OpenBao account password. Setup, manual session
and limited-verification helpers now share this parser; setup was not executed.
Protected-file permissions/non-symlink rules and mount isolation remain required.

**The existing protected handoff can safely be reused through this parser.** The
original file was mounted read-only; before reuse, exact owner-only/single-link
metadata, exclusion from every running container mount, CA readability and private
session tmpfs were rechecked. Only the documented password and CA were mounted.

## Non-secret verification results

- Synthetic raw/LF/CRLF representations decode to the exact same generated test
  password, including minimum and maximum payload lengths; input Buffers stay
  byte-for-byte unchanged. Malformed and out-of-bound inputs reject.
- Final combined preparation tests: **28 passed**, including parser, protected
  file, missing-approval/custody refusal and exact capability scope/cleanup cases.
- Scoped ESLint and Prettier passed. No credential account or stored secret changed.

## Single authorized retained session

With the parsing issue resolved, the owner's conditional continuation allowed the
unused single login. It executed once at **15:25:43 Asia/Manila (+08:00)** and ended
within one second. [Sanitized session result](p3-u3a-retained-capability-session.json).

Login succeeded. Self lookup confirmed expected username and login path, sole
`platform-deployment-maintainer` policy, no identity policies or period, orphan
service token, unrestricted use count, bounded TTL and 900-second creation TTL
and explicit maximum. The verifier's additional display-name expectation differed.
The observed display-name string was deliberately not retained or emitted.

Per the approval's unexpected-identity stop condition, observation stopped there:
**one login, one self lookup, zero capability-query batches**. No protected resource
contents, inventory, issuer tokens or policy bodies were fetched. Exactly one
self-revocation was acknowledged and the confirmation self lookup returned **403**.
Cleanup is **revoked and denial confirmed**; the ephemeral helper was removed.
No renewal or child session was issued. **The one-login authorization is consumed;
no retry or additional retained session is authorized.**

The display-name difference remains a verification limit, not evidence of extra
privileges or proof that current capabilities match the source policy. A separate real disposable OpenBao 2.7.1 run confirmed that native userpass at the
custom auth mount uses that mount's display-name prefix, rather than the helper's
assumed default `userpass` prefix. Only comparison booleans were retained
([disposable evidence](p3-u3a-disposable-runs/e31d6ef7-ce65-4095-8c2b-58d926c34040.json)).
The local check and synthetic fixture now require the exact custom-mount prefix;
wrong/default prefixes still reject. This corrects a local verification assumption,
not provider identity configuration. The actual retained field was not saved, so
this does not retrospectively establish that it matched the corrected expectation. Even correction
of a local display-name assumption cannot authorize another retained login.
Backup/maintenance availability remains **unknown, not absent**.

## Boundaries and local continuation

The owner accepted a stable snapshot backup identity and separately controlled
attended maintenance authority as the preferred direction for **further design
review only**. No identity/job/policy/role implementation is authorized by that
acceptance. Retained remediation, inventory/backup capture, restart, recovery,
restore and SIP/PBX/production effects remain separately gated.

Independent local lifecycle-helper work added an investigation-only bounded
same-token reconciliation candidate with 15 passing simulated groups and real
disposable lost-renewal-response probes; see
[local evidence](p3-u3a-same-token-reconciliation.md). It remains inactive. Native near-expiry HTTP 500,
expiry overruns and unresolved browser recovery evidence remain preserved. Local
helper tests do not establish retained security or P3-U3a completion.
