# P4-U2a allocation policy review

Prepared 2026-10-30 (Asia/Manila, +08:00). **Approved by the owner in chat, 2026-10-30 (Asia/Manila, +08:00).**
Approval includes the requested active-tenant capacity expansion amendment.
P4-U2a implementation and A-01–07 acceptance are complete within approved private development; [final evidence](../status/p4-u2a-evidence.md). Parent/b/c decisions remain scoped as recorded below.

The [child specification](../../context/feature-specs/p4-u2a-exclusive-tenant-inventory-allocation.md)
requires resolution of parent [ALLOC-01 and applicable ALLOC-06](../../context/feature-specs/p4-u2-allocate-inventory-and-verify-tenant-routing.md#decisions-required-before-dependent-implementation)
before dependent code. The owner explicitly approved this amended policy before dependent implementation.

## Approved ALLOC-01 decision

- Claim only existing extension UUIDs. Both `reserved` and `allocated` exclusively
  own stock for one tenant; neither grants staff assignment or calling readiness.
  Permit new reservations or direct allocations and explicit versioned promotion
  from reserved to allocated. No automatic expiry, future-stock capture, implicit
  demotion or implicit transfer. Release ends a current claim but retains history.
- Permit desired-disabled stock for reservation and allocation, showing its disabled
  status in preview and saved facts. Disabling stock retains ownership. Calling
  eligibility remains separately denied until later verified readiness.
- Use one node per batch. A tenant may hold separate batches on multiple nodes;
  each batch and claim retains its exact node and installation identity. This
  permits placement without implementing migration or cross-node calling.
- Accept 1–50 distinct existing UUIDs or an inclusive ascending step-one range
  expanding to 1–50 numbers. Reuse existing number normalization: strings with only
  outer ASCII spaces trimmed, canonical 1000–899999, no leading zeros. Preview
  every number, including gaps and conflicts. Any absent, ineligible or
  foreign-owned item rejects the entire save; never create or skip stock. Duplicate
  UUIDs reject. Existing own claims are displayed separately and cannot be silently
  converted by a new batch. Promotion uses the existing claim and expected version.
- Permit saved draft and active tenants to reserve or allocate existing extensions
  and promote reservations to allocations. Active tenants can expand their capacity
  through the same bounded, exclusive, versioned workflow. Recheck canonical tenant
  status at commit; suspended and retired tenant mutations deny. Saving preserves
  tenant status, existing claims, staff assignments and credentials. Voice preference
  is displayed independently; newly claimed capacity requires separate verified
  readiness before calling permission can be granted.

The 50-item bound matches existing inventory bulk selection. Disabled-stock
selection accommodates inventory's existing default desired-disabled state.
These choices were explicitly approved by the owner.

## Approved scoped ALLOC-06 decision

Allow explicit versioned release only for provably unreferenced desired-only
claims: no staff assignment, desired dependency, installed/in-flight/rollback pin
or unknown runtime/call safety. Check actual dependencies, including
`RuntimeDependencyPort.assertUnreferenced`, under the canonical node lock.
Unavailable dependencies deny release; retain ownership and show bounded blockers.
A never-installed resource needs affirmative canonical evidence of that condition;
absence of a browser observation cannot prove safety.

Defer installed-resource release, transfer and artifact retirement to child c's
policy and live proof. Add no pin bypass, automatic retirement, forced call
termination or deletion of ownership history. This scoped approval resolves
only a's desired-only release and blocker behavior; parent ALLOC-06 remains open
for c's installed-resource safe-transfer scenario.

## Resume and verification

Record these approved choices in the parent policy register and
synchronize affected architecture before allocation schema/API/UI work. Then
publish exact DTOs/routes, lock ordering, replay scope and safe errors before
coding as required by the child. Implement the complete operator journey and
prove A-01–07 with the specified real PostgreSQL/Redis/two-replica/API/HTTPS and
regression checks. This preparation has no runtime verification result.
