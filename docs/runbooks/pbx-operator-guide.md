# Operator PBX registry guide

Use the private [secure platform console](platform-development-https.md) and
sign in as a currently authorized platform operator. Open **PBX nodes**. List and
detail reads refresh the shared observation every five seconds, without renewing
sessions or starting observers. Use Previous/Next page for bounded 25-node pages.

## Register and inspect

Select **Register PBX**. Enter a descriptive PBX name and the deployment owner's
approved target alias, management transport/port and opaque credential alias.
For the approved local development installation these are `local-asterisk`
(`local-pbx` is an equivalent alias), `ami-tls`, `5039` and
`local-asterisk-observer`. Other environments must supply approved profiles.
Never enter credentials, URLs or provider file locations. The browser cannot
resolve secrets or discover arbitrary targets. An unavailable secret does not
prevent saving a permitted desired record.

Submit **Register PBX node** explicitly. Duplicate clicks are suppressed. Invalid
fields and installation conflicts retain your input and focus an actionable field.
One installation can have only one canonical registry node. Confirmed success
opens its canonical detail. A registry save does not apply Asterisk configuration,
create extension inventory, allocate a tenant or establish voice readiness.

Detail separates **Saved desired connection** (identity, version, target, TLS
name and opaque reference) from **Runtime observation**. Saved means only that
the desired record committed. Not yet observed means no runtime projection is
available. Reconciling means the observer has not completed a qualifying snapshot.
Reachable describes current observation only when freshness/version/ownership
qualify it. Disconnected and finite secret/auth/configuration failures remain
node states. Historical or stale last-known facts do not establish current health.
After 30 seconds since success, freshness is stale. Timestamps use Asia/Manila
(+08:00); age is elapsed seconds. Unknown coverage/counts differ from an
explicit successful empty registration result of zero.

PJSIP dynamic-contact facts are unmapped observations. Registered contacts do not
mean allocated, assigned, verified extensions or a voice-ready tenant. Inspect
endpoint facts through the keyboard-accessible disclosure when needed.

## Edit and reconcile uncertain writes

Edit the desired fields on detail and select **Save desired connectivity**. The
form submits the saved expected version. A newer version rejects the edit and
preserves your current input. Select **Reload saved version for review**, compare
your retained input with the newly saved connection above, then explicitly save.
A connectivity/reference change invalidates current observation until the new
version reconciles. Name-only changes can preserve qualified runtime facts.

A lost create response is uncertain: the backend may have committed. The original
operator-bound key/payload stays locked. Restore access and select **Retry original
create** explicitly; this reuses the same receipt and opens canonical detail on
confirmation. A create retry returns the original saved result; detail supplies
current state. Alternatively follow **Reload canonical registry**, inspect all
pages for the target and open its existing detail. Only after that review use
**I reviewed the registry; release prior create intent** to unlock a new intent.
An expired retry window (30 days) also requires canonical registry review.

A lost edit response requires **Reload saved version for review** before another
edit. Restoring authentication never replays a create or edit. Registry reload
and retries do not multiply backend observers.

## Access recovery and escalation

When authorization expires, protected values are hidden and submission stops.
Sign in with the same canonical operator to restore unfinished non-secret work,
then resume explicitly. Another operator or confirmed sign-out clears all retained
values/intents and protected presentation. A full reload, tab close or application process loss discards the draft; no
browser storage is used. A 403 is denied access; a 503 is
retryable platform/session unavailability with an explicit bounded retry. Node
observation failures remain distinct from platform API failure. Other healthy
nodes remain inspectable when one node fails.

Escalate missing/inaccessible references or TLS/destination/configuration failures
to the deployment owner, and PBX connectivity/authentication/observer failures to
telephony operations. Supply canonical node ID, saved version, safe failure label
and last-success age, never credential material. Follow
[observation operations](pbx-observation.md) for approved access, settings,
rotation, ownership recovery and shutdown. Never reset epoch rows or widen
permissions to recover. Configuration apply/reload/rollback is a later workflow.
