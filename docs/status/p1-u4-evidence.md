# P1-U4 verification evidence

## Boundary and environment

P1-U4 establishes shared web presentation and distinct operations shells under
the [feature spec](../../context/feature-specs/p1-u4-web-primitives-and-operations-shell.md).
It does not implement identity, operational data or protected workflows.

Verification uses the project's Docker workspace, pinned Node/pnpm dependencies
and Chromium installed inside that workspace. The browser suite starts production
Next.js instances on private ports 3200/3201 and stops them afterwards. Development
previews retain the existing published ports. Commands and setup are in the
[web UI runbook](../runbooks/web-ui.md).

## Incremental evidence

- P1-U4a: frozen dependency install, scoped UI/app lint and typechecks, UI package
  build and both production app builds passed. Browser checks in both apps
  confirmed body/surface/radius values and actual loaded Inter, Barlow Semi
  Condensed and JetBrains Mono fonts.
- P1-U4b: UI-package lint/build and app typechecks passed. Browser checks in both
  apps passed for value preservation, pending action state, retry, overlay focus
  containment/restoration, Escape, tabs and overflow menu operation. Axe checks,
  1440/768/390/320 CSS-pixel reflow and reduced-motion behavior passed. Desktop and
  narrow component captures were inspected visually.
- A development hot reload interrupted a font check; its sequential rerun passed.
  Two overlapping runs collided in trace output; the affected platform reflow
  check was repeated alone and passed. These failed attempts were not counted as
  passing acceptance evidence.
- Turbopack panicked on a previously removed temporary route. The two operations
  previews now use supported Webpack development mode, matching their build mode.
  This preserves the existing Next.js stack and is documented in the runbook.

## Contrast procedure

Measured the documented sRGB palette against actual surfaces. Secondary text on
all four surfaces is at least 8.27:1, muted text at least 4.56:1 and primary text
at least 12.52:1. Field-error red on the panel surface is only 4.42:1; errors use
the elevated surface instead (4.76:1). Control borders use the muted text token
rather than relying on the low-contrast default divider border. State meaning
also uses visible labels. Browser axe checks exercise the rendered pairings,
including overlays and invalid form state.

## Final integration checks

`./dev exec pnpm check:ui` passed all 12 tests against the two production builds
on 2026-10-04 18:04 +08:00 (Asia/Manila). Coverage includes both homes, direct
refresh, selected navigation, pending areas without links, skip-link focus,
compact navigation dismissal, component interactions, invalid-input state,
reduced motion and rendered accessibility scans.

Inspected captures for both apps at 1440×900, 768×1024 and 390×844, plus 200% CSS
zoom in the browser. Reflow at 320 CSS pixels is also asserted. Primary actions,
error text and content remain readable; no page-wide horizontal overflow was
observed. Captures are available locally in ignored `.local/ui-review/`.

The first full check's terminal connection ended while Docker continued running
checks. It was not recorded as a full pass. The complete `./dev check` sequence
(`pnpm check` followed by `pnpm check:foundation`) passed through Docker detached
execution on 2026-10-04 18:18 +08:00. `.local/p1-u4-check.log` retains the full log;
`.local/p1-u4-check.exit` contains `0`. This includes all lint/format/type/build
checks, both mobile platform exports, backend entry-point isolation/configuration
checks and the live baseline migration/outage/recovery rehearsal.

The exact logged invocation was:

```sh
docker compose -p myims-rebuild-dev -f infra/docker/compose.yaml exec -d -T --user node workspace sh -c 'pnpm check > .local/p1-u4-check.log 2>&1 && pnpm check:foundation >> .local/p1-u4-check.log 2>&1; task_check_code=$?; printf "%s\n" "$task_check_code" > .local/p1-u4-check.exit'
```

Final frozen install passed with the synchronized lockfile. Restored development
homes on published ports 3100 and 3101 returned HTTP 200.

Local documentation file-link checks and `git diff --check` passed. P1-U4 and all
three subunits are complete within their declared foundation boundary.

## Limits

Browser automation and visual inspection establish this foundation boundary.
They do not certify screen-reader or native touch-device behavior, hosted CI,
production accessibility targets, authenticated cross-plane isolation, operational
workflows, live PBX integration or readiness for operational launch. Future feature
units must supply backend access checks and canonical data rather than treating
shell navigation as authorization.
