# Verify tenant routing and release superseded resources

P4-U2c is complete within approved private development. See the
[contract and limits](../architecture/tenant-routing-verification.md) and
[current evidence](../status/p4-u2c-evidence.md). Do not interpret a saved binding,
registration, offline validation or an old P3 probe as tenant calling readiness.

For the full a/b/c walkthrough and manual sign-off, use the
[P4-U2 manual test guide](../guides/p4-u2-manual-testing.md).

## Operator workflow

1. Configure explicit voice preference, allocate existing enabled stock and save
   exact owned inbound/DID/group bindings and outbound trunk permissions.
2. Open the PBX revisions page from tenant routing. Capture the exact desired
   state, review affected ownership/resources and runtime diff, then validate.
   Apply only that current reviewed revision through the existing live panel.
3. Expand tenant route bindings and select the PBX. The verified routing panel
   shows current provenance and explicit blockers. A deployment-approved controlled
   manifest must exist; no configured cases means testing is unavailable.
4. For a draft, explicitly grant the displayed controlled cases for at most
   30 minutes. Select the grant and a case, then run one bounded test. Repeat only
   through separate explicit intents after known completion. Test every required
   positive and negative case for both tenants on the shared PBX.
   For an existing active tenant, leave the draft grant unselected; the committed
   controlled test still consumes its exact one-shot nonce and provenance.
5. Reload evidence. Inspect actual destination, expected/outcome, revision/artifact,
   current/stale explanations and readiness. Registration and tenant lifecycle
   remain separate; this workflow does not activate a tenant.
   An unexpected permitted isolation result blocks the shared runtime until a
   reviewed runtime change and fresh evidence. Revoking a grant does not repair it.
6. Revoke grants and apply a reviewed configuration removing verification paths.
   Verify cleanup. Expiry stops admission but does not claim loaded paths were
   removed. Explicit voice-disabled needs no invented test success.

If a response is lost, use the exact retained intent recovery button. Never change
its target or generate another call merely because the response timed out. Unknown
calls require **Reconcile call safety** and actual quiet proof. A reconciled unknown
call remains failed/unknown historical evidence; a new call needs explicit review.
Owner/tenant/node changes discard unrelated mounted work; same-owner reauthentication
retains the exact request. Hard-refresh persistence is not provided.

## Installed extension release

1. Remove desired permissions/references through their existing versioned workflows
   where allowed. Disable the extension and review/apply a replacement that omits
   its endpoint/material dependencies. Remaining group/rule dependencies may require
   an intermediate denied replacement before their safe desired removal.
2. Inspect exact retained blockers. In the revisions page, select the superseded
   artifact and the extension omitted by the current verified replacement. Review
   the replacement and required recovery targets, then request exact retirement.
3. Actual calls or unknown safety defer retirement; do not force hangup or clear
   pins manually. An unknown retirement needs the explicit reviewed reconciliation
   button. Artifact bytes/history remain retained and retired recovery targets deny.
4. Clear remaining desired/assignment blockers and use the existing versioned
   allocation release action. Only then allocate existing eligible stock to the
   next tenant and obtain fresh revision, grant and test evidence. Retain original
   claim/history and old call provenance.

Keep the initial baseline, current installed/verified/known-good artifact and every
required pending recovery target. General pruning and credential destruction are
outside this workflow.

## Reproducible Docker verification

The controlled native module profile includes `res_speech`, `res_agi`,
`func_channel`, `res_pjsip_header_funcs`, `res_pjsip_endpoint_identifier_ip` and
`bridge_simple` alongside the existing PJSIP/Dial modules. New prepared profiles
and disposable fixtures include these prerequisites. An older retained profile
must not have its static configuration rewritten under an existing artifact:
all `.conf` bytes participate in the immutable unmanaged digest. Native offline
validation rejects missing capabilities before selection. Retained-profile upgrades
must preserve their baseline/recovery contract; this feature performs no silent
rebaseline or static-profile replacement. The supplied RTP reference is diagnostic;
ordinary RTP publication and source checks are unchanged.

Run from the repository root:

```sh
./dev exec pnpm check:tenant-routing --live
./dev exec pnpm check:tenant-routing --api
./dev exec pnpm check:tenant-routing --browser
./dev exec pnpm check:tenant-routing --concurrency
./dev exec pnpm check:tenant-routing
```

The API/browser/concurrency selections run the integrated real binding/allocation
matrix, including actual HTTPS and replica races; they are not smaller isolated
proofs. `--live` runs disposable actual Asterisk/SIP/RTP and PostgreSQL with an
ordinary durable worker. Default includes both boundaries. These modes do not
replace required existing native/interruption/real-provider revision checks.

Required affected checks also include draft tenant, inventory, trunk/gateway,
routing, revisions, platform/staff authority and `./dev check`, as listed in the
child spec. Preserve normal tenants, runtime/provider material and required recovery
artifacts. Remove only the run-owned fixtures after verified restoration; record
actual failures/retries and command exits. Formatting or fixture setup alone never
satisfies live acceptance.

The current SIP fixtures use private identities and no external trunk. Adding real
external endpoints/destinations or another environment requires their exact approved
manifest/access. Production rollout, staff assignment and operational call ingestion
remain outside this unit.
