# Trunk credential setup — development

October 23, 2026, Asia/Manila (+08:00). Follow the
[current P3-U3 spec](../../context/feature-specs/p3-u3-development-resource-management.md#simple-credential-setup).
This guide describes the intended simple workflow; its replacement setup command
has not yet been implemented. Do not treat old helper scripts as the new command.

1. The development administrator supplies material locally through a trusted setup
   command, with hidden input or a protected file. Keep it out of command arguments,
   logs and browser state.
2. Setup stores it in the existing trunk OpenBao namespace and records selectable
   nonsecret label/installation/purpose/version metadata only after confirmation.
3. The platform operator chooses that label in a trunk form. A saved association
   is desired configuration; actual delivery/registration belongs to later apply.
4. Replacement creates a retained material version, then the operator deliberately
   adopts it through an ordinary versioned edit. No credential reveal or automatic
   destruction of referenced versions is needed.

IP-peer definitions require no credential setup. Their API implementation is the
next feature slice and can proceed while administrator migration is prepared.
Retain existing endpoint/provider configuration and data. Ordinary maintenance will
use a practical development administrator; recovering root is not the routine path.

The [old detailed provisioning runbook](../archive/p3-u3/2026-10-23/docs/runbooks/trunk-credentials.md)
is historical. Existing OpenBao/admin credentials and backup pending records have
not been changed by this design/documentation transition.
