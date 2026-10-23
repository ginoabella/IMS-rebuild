# P3-U3b — Simple trunk credentials

Status: planned; replacement sub-unit approved October 23, 2026, Asia/Manila
(+08:00). Follows [a](p3-u3a-trunks-and-gateways.md).

Parent: [P3-U3 development delivery](p3-u3-development-resource-management.md),
especially its simple credential setup contract. This b is credential delivery;
the old b covered DIDs and is archived. The old a-1 isolated lifecycle is not a
prerequisite or an additional required child.

## Goal and starting point

The development administrator can set up a trunk credential through one trusted
command. A platform operator can select it in the existing trunk form, save a
digest definition and deliberately adopt a replacement material version.

Start from a's working APIs/browser and the retained OpenBao installation. Reuse
useful storage/helpers after checking their actual dependencies; do not wire in
the unfinished reservation/attestation/cleanup-worker pipeline. Preserve existing
endpoint credentials, provider state and backups.

## Scope

- Implement a trusted local setup/update command using hidden input or a protected
  file. Keep material out of argv, logs and resource/browser responses.
- Store material in the existing trunk namespace. Publish stable credential ID,
  label, installation, purpose, actual material version and administrative
  availability only after successful storage confirmation.
- Give setup a practical supported development administrator/service credential
  configuration. Verify actual issued lifetimes against mount limits; provide
  clear expired/unavailable errors and a supported credential replacement path.
  Prepare any needed changes to existing services as a concrete migration; do not
  replay a consumed bootstrap or recover root as routine command behavior.
- Add bounded metadata selections to the existing API/browser. Validate selected
  ID/version, installation, purpose and availability in ordinary transactions.
  Keep HTTP/Next independent of OpenBao material access.
- Extend a's forms/records for outbound digest and optional desired registration
  under the parent's typed profile. Registration requires digest and explicit
  registrar/realm; no live registration is attempted in this unit.
- Explicit versioned edits adopt replacements. Existing definitions keep their
  selected versions; retain referenced material, with no automatic destruction.
- Report ordinary failed setup/login as recoverable. Reconcile a genuinely
  uncertain provider write against its exact identity before another write; do
  not advertise incomplete imports as successfully selectable.

No 60-second proof, generation ordinal, separate claim/adoption protocol,
five-role worker system, token-renewal certification or new backup subsystem.

## Acceptance

| ID | Working result / verification |
| --- | --- |
| B-01 | Actual trusted command stores synthetic owned material in real OpenBao and publishes matching selectable metadata. Missing, denied, expired and unavailable setup produce useful failure rather than false success. |
| B-02 | Actual trunk browser/API selects a valid label/version and saves digest/optional registration settings. Wrong installation/purpose, missing/inactive versions and incompatible settings reject; IP-peer remains independent. |
| B-03 | Replacement creates a confirmed material version and explicit expected-version adoption works. Old selections remain unchanged; response loss or interrupted setup cannot publish a false result or silently overwrite uncertain work. |
| B-04 | Secret sentinels remain absent from resource DTOs, browser state, receipts, audit and normal logs. HTTP/Next do not gain provider material access; setup causes no PBX/live registration effects. |
| B-05 | a's IP-peer/browser workflow still works. Focused real OpenBao/PostgreSQL/API/browser checks, affected regressions and the normal repository check pass. The setup/replacement command and failure recovery are documented. |

Owns DEV-02 and the credential portions of DEV-04–07. Actual credential integration
must pass before authenticated support is complete; a simulator does not establish
OpenBao acceptance. Backup repair/scheduling/joint recovery remain separate work.

## Handoff

[c](p3-u3c-did-inventory-and-integration.md) uses these same trunk/gateway forms
and stable references in the integrated journey. Document actual commands and
custody/configuration without secret values. b completes credential setup and
selection, not carrier connectivity, live apply or parent P3-U3 as a whole.
