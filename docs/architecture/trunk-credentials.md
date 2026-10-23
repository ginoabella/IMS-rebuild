# Trunk credentials — simple development model

Owner-approved direction: October 23, 2026, Asia/Manila (+08:00).
The [replacement P3-U3 spec](../../context/feature-specs/p3-u3-development-resource-management.md#simple-credential-setup)
is authoritative. This is an intended design; simple setup and resource integration
are not implemented/accepted yet.

Keep existing OpenBao and a trusted administrative setup command. That command
stores material and publishes a stable, installation-qualified ID/label/version
for selection by trunk definitions. HTTP and Next use only nonsecret metadata.
Ordinary resource edits validate that metadata in their normal transaction.

No fresh 60-second attestation, separate claim/adoption protocol, five-role worker
pipeline, generation ordinal or automatic orphan cleanup is required. Referenced
material versions remain available; changes are adopted through a normal versioned
resource edit. Failed/uncertain imports must not publish successful selections.

Provide a practical development administrator and service credential configuration
with a supported replacement path. Validate actual issued lifetimes against mount
limits. Exact short-lived token and renewal certification is not a P3-U3 gate.
Existing platform permissions, record ownership, audit and secret redaction remain.

Reuse existing schema/helpers where useful. Existing owner/reservation tables and
workers are not evidence of accepted binding support and are not removed by this
change. Preserve endpoint flows and existing provider material during migration.
See [implementation state](../../context/progress-tracker.md) and
[credential operations](../runbooks/trunk-credentials.md).

The [previous owner contract](../archive/p3-u3/2026-10-23/docs/architecture/trunk-credentials.md)
is archived history. Its acceptance matrix does not govern current P3-U3 delivery.
