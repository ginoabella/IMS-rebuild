# PBX console browser contract

P3-U1c composes the delivered [registry](pbx-registry.md) and
[observation](pbx-observation.md) contracts under the existing
[platform browser authority and recovery boundary](platform-browser-access.md).
Next owns no database, sessions, credentials or observer. Dynamic protected
server layouts validate current backend identity; client reads and writes use
named protected forwarding with the same backend authority.

Delivered paths are `/pbx-nodes`, `/pbx-nodes/register` and
`/pbx-nodes/:nodeId`; these literal paths are also allowed secure sign-in returns.
Next forwards only GET/POST `/platform/pbx-nodes` and GET/PATCH
`/platform/pbx-nodes/:nodeId`. Query, UUID, method, bounded body and DTO shape
validation precede forwarding. Existing exact HTTPS Origin, CSRF, channel,
trusted ingress/socket source and no-store rules apply. Mutation bodies are at
most 4096 bytes; observation response streams are at most 32 MiB (100 nodes,
1,000 facts each), additionally constrained by DTO cardinalities. Unknown response
keys and invalid DTOs fail closed. Error copy/field keys/conflict reasons are
allowlisted; raw upstream errors and provider material never reach the browser.

The application-mounted `ConsoleAccess` retains one create draft/immutable
attempt and one target-specific edit draft in `RetainedWork`, bound to canonical
operator ID. A create attempt holds its UUID and exact payload from transport
start until confirmed, rejected before commit or explicitly reconciled through
canonical registry review. Input is locked during uncertainty. No automatic
write replay occurs after access restoration. Edits retain their expected version
and require explicit canonical version reload/review after conflict or uncertain
response. Same-owner restoration preserves mounted memory; identity replacement
and confirmed logout clear it. No persisted browser drafts exist.

Authority epochs, mounted-operation epochs, resource cleanup and read generations
fence delayed reads/mutations across access loss, target/navigation changes,
identity replacement and confirmed saves. Passive reads are serialized with a
five-second interval after completion; no heartbeat or renewal is issued. The
backend supplies freshness/ownership/version qualification; elapsed client age
can only demote a previously received success at the approved 30-second threshold.
Successful empty registrations, unknown coverage/counts and last-known facts are
separate text states. Registry save implies neither configuration apply nor voice
readiness.

P3-U2 receives canonical node/installation identities and passive safe registry/
observation consumers, with registration coverage/freshness semantics intact.
P3-U5 receives the backend ownership port and transactional fence from b, with
external stale-owner fencing, ordered revisions and live apply still unfulfilled.
See [operator guide](../runbooks/pbx-operator-guide.md) and
[combined evidence](../status/p3-u1c-evidence.md).
