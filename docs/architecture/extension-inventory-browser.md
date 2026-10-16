# Operator inventory browser contract

P3-U2c consumes the verified inventory/profile and credential owner APIs under the
[user's conditional G-03 approval](../planning/p3-u2c-observation-mapping-contract-review.md).
The protected page `/pbx-nodes/:nodeId/inventory` is reached through PBX detail.
It creates SIP/WebRTC stock individually or through reviewed bounded bulk sets,
creates/versions/selects profiles, explicitly adopts selected versions, submits
expected-version desired status changes and asynchronous credential setup/reset.
Profiles remain pinned. Every save remains desired state only.

Next's inventory consumer accepts only explicitly enumerated resource/method
combinations below the canonical node UUID: extensions list/create/detail/edit,
status edit, bulk preview/commit, endpoint profile list/create/version/detail,
credential setup/reset/status and operation status. The catch-all route is an
adapter to that allowlist, never an arbitrary upstream path. Query fields, UUIDs,
methods, 4 KiB bodies and 64 KiB result streams are bounded. Strict known-key DTO
validation rejects secret-bearing additions. Errors use finite safe copy/reasons
and canonical conflict numbers. Existing HTTPS ingress, exact origin, cookie
channel, current backend authority, CSRF and no-store rules apply at every hop.

The existing application-mounted `ConsoleAccess` holds non-secret inventory work
in `RetainedWork`, bound to the canonical operator. A workflow UUID and canonical
node qualify inputs, preview, selected saved extension/profile and immutable
mutation attempt. Input locks during an uncertain attempt. Explicit same-intent
POST retries retain their original request/operation IDs and exact payload;
versioned PATCH uncertainty requires canonical review. Changed input invalidates
the advisory bulk preview and receives a new reviewed mutation intent. Successful
writes and stale conflicts require an explicit canonical review before another
action. The app never replays writes after sign-in, reconnect or passive reads.

Authority and resource generations fence callbacks. Expiry hides/inerts the
protected subtree and blocks writes. Same-operator explicit sign-in restores
mounted safe work; foreign identity/confirmed logout clears it. Full refresh or
process loss discards it. Browser storage, server drafts and secret-entry/reveal
fields are absent. Credential operations return only safe status/generation IDs;
configured desired material never means active PBX credentials or revocation.

Inventory list/detail compose one shared node projection per primary snapshot
through the [inventory contract](extension-inventory.md#p3-u2c-passive-composition-and-browser-compatibility).
Exact canonical node/installation and all persisted generated keys must agree.
Only fresh complete covered facts can establish registered, unregistered or
endpoint absent. Other states remain unknown; elapsed browser age can demote
facts at 30 seconds. Auth/AOR keys never serve as alternate observation lookup
fields and no generated keys enter inventory DTOs. PBX-only failure leaves desired
management available when canonical database/session dependencies are healthy.

The browser uses shared token-based primitives, semantic labeled controls,
announcements and responsive wrapping. Inventory reads are explicit; none renew
sessions or issue AMI commands. The existing node page continues its passive
shared-projection refresh. No sockets, live deployment, calling client, tenant
allocation, staff assignment or ownership-status selector is introduced.
