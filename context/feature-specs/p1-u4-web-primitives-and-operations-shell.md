# P1-U4 — Web primitives and operations shell

## Status and purpose

- **Status:** implemented and verified; P1-U4a/b/c completed on 2026-10-04
  18:18 +08:00 (Asia/Manila). See [evidence](../../docs/status/p1-u4-evidence.md).
- **Prepared:** 2026-10-04 17:18 +08:00 (Asia/Manila).
- **Requirement:** [Phase 1, P1-U4](../implementation-plan.md#p1-u4--establish-web-primitives-and-the-operations-shell).
- **Goal:** give subsequent feature units a consistent, accessible web foundation
  and distinct platform-console and command-center homes.
- **Completion boundary:** shared components and navigable foundation shells,
  verified in the browser. This does not deliver authenticated operations.

Authoritative sources are [overview](../project-overview.md),
[architecture](../architecture.md), [UI context](../ui-context.md),
[code standards](../code-standards.md), [workflow](../ai-workflow-rules.md),
and [observed progress](../progress-tracker.md). This spec applies their existing
requirements; it does not adopt pending P1-U1 product recommendations.

## Starting state and dependencies

P1-U2 is complete. `packages/ui-web` exists as `@myims/ui-web`, but its entry point
exports no components. Both web apps depend on it and contain App Router root
layouts and placeholder home pages. Neither app currently has shared theme CSS,
Tailwind/shadcn setup, interactive primitives, or an operations shell.

P1-U3 is complete but is not a P1-U4 dependency. Shells and demonstrations use
explicitly labelled, non-sensitive fixtures and need no backend connection.
P1-U1 product contracts remain deferred. They do not block generic presentation
work; permissions, lifecycle rules and credentials stay with their owning units.

Before implementation, recheck these files and the P1-U2 checkpoint. Treat file
inspection as evidence of starting state, not a rerun of prior runtime checks.

## Scope and ownership

| Boundary | Allowed changes |
| --- | --- |
| `packages/ui-web` | Shared theme, typography, accessible primitives, exports, Tailwind/shadcn conventions and component usage documentation. |
| `apps/platform-console-web` | Consume shared UI; platform shell, home and component preview route. |
| `apps/command-center-web` | Consume shared UI; command-center shell, home and component preview route. |
| Workspace configuration | Required dependency pins, lockfile, UI build/JSX/CSS integration and focused browser-check wiring. |
| Documentation | Usage guide, verification evidence and tracker checkpoint. |

Keep tokens and generic controls in one shared package. App-owned navigation and
workspace composition belong to the apps. Shared shell building blocks may live
in `ui-web`; the package must not import either app or domain services.
Use Server Components by default and limit client boundaries to interactions.
Preserve dependency-ordered workspace builds and the Docker development workflow.

Out of scope: authentication, session guards, role visibility rules, tenant
selection, sign-in/logout actions, domain schema/APIs, audit/jobs, live health,
PBX administration, maps, incident intake, dispatch, dashboards/reports, public
or mobile redesign. No fabricated operational counts, live status or successful
mutations. Incident/responder-specific wrappers arrive with their feature units.

## Shared visual foundation

1. Define every color variable from UI context in shared CSS, preserving its
   documented name and value. Feature markup uses semantic tokens rather than
   hardcoded colors. Map colors are tokens only; no map implementation is required.
2. Configure Tailwind to consume the shared tokens and include shared component
   styles in both apps. Document shadcn conventions and ownership; do not install
   an entire unused component catalog.
3. Load Inter, Barlow Semi Condensed and JetBrains Mono with the specified font
   variables and roles. Use a reproducible asset-loading approach that does not
   require runtime access to a third-party font service; record asset licensing.
4. Apply compact, readable typography and the documented `rounded-md`,
   `rounded-xl` and `rounded-2xl` contexts. Keep reset/theme imports consistent.
5. Show default, hover, focus, active/selected and disabled states. Focus must be
   visible; hover must not shift layout. Respect reduced motion.

## Minimum reusable component set

| Capability | Required behavior |
| --- | --- |
| Actions | Primary, secondary and destructive buttons; pending/disabled state; accessible icon-only action. |
| Surfaces | Panel/card, heading, divider and compact content grouping. |
| Forms | Labelled input, textarea, select and checkbox; required/optional indication; associated help/error text. |
| Data display | Semantic table with headers, visible primary row action and an accessible overflow action pattern. |
| Status | Generic labelled badge plus information, success, warning and error feedback; meaning never depends on color alone. |
| Async content | Loading, error with retry, empty and no-results states; status announcements where needed. |
| Navigation | Links and selected navigation state; tabs for local content and a sheet/drawer for secondary content. |
| Dialogs | Focused modal/confirmation dialog with accessible title, keyboard dismissal, contained focus and focus restoration. |

Use shadcn-based accessible patterns for relevant controls. Inspect generated
ownership before editing; project wrappers must respect protected-file rules.
Do not require all future popovers, command menus or toasts for this foundation.
Native table semantics suffice; server pagination/filtering and a data-grid engine
are not part of this unit.

Provide a component preview in each app at `/ui-preview` using shared examples.
It is a labelled foundation demonstration containing no operational information.
It must demonstrate a validation failure that preserves typed values, a pending
action that prevents duplicate activation, retryable error, loading, empty and
no-result states, a table and modal/drawer/tab interactions. State changes are
local demonstrations, with no persistence or backend mutations.

## Shell behavior and user journey

Each app's `/` is its separate home, with its own title and navigation model:

- **Platform console:** platform identity in the header; platform overview home;
  future Asterisk and tenant-management areas visibly marked as pending.
- **Command center:** command-center identity in the header; operations home;
  central workspace and contextual panel regions; future incident, dispatch and
  tenant-administration areas visibly marked as pending.

Only implemented destinations are links: Home and UI preview. Future sections
are non-interactive pending labels, not links to missing pages. Do not show a
signed-in operator, tenant, session or role. Navigation separation communicates
app ownership; it is not an authorization boundary.

Journey: open an app home, identify the correct application, navigate to its UI
preview, operate the examples with a keyboard, then return Home. Both apps use
the same visual system while retaining distinct app-level composition.

Use a full-height shell, persistent top bar, navigation region and semantic main
content. Include a skip link. At desktop widths, keep primary workspace and
context panels visible together where space permits. At smaller widths, reflow
panels and move secondary navigation/content into accessible disclosure controls.
Warnings, validation messages and primary actions remain visible. Permit internal
table scrolling only where the content cannot reasonably reflow; avoid page-wide
horizontal scrolling and scroll regions that trap keyboard users.

## Acceptance and required verification

These are completion criteria for implementation, not checks already performed.

| ID | Observable result and required check |
| --- | --- |
| AC-01 | Both apps consume the shared CSS/components and show the documented fonts, token colors and radius contexts. Inspect computed styles and imports; confirm no app-local duplicate theme. |
| AC-02 | Required component capabilities and all feedback states render in both previews. Compare against the component table and inspect accessible names/roles. |
| AC-03 | Submitting the demonstration with invalid input preserves entered values and associates field errors. Pending activation prevents duplicate handling; retry returns the example to its declared state. Verify browser behavior. |
| AC-04 | Keyboard users can skip navigation, follow links, operate fields/tabs/menus and open/close overlays. Focus remains visible, stays in modal overlays and returns to their trigger after dismissal. Verify Tab, Shift+Tab, Enter/Space, Escape and applicable arrow keys. |
| AC-05 | `/` and `/ui-preview` load directly and on refresh in both apps; current navigation is indicated. Future sections make no readiness claim and produce no broken links. Verify navigation and browser console. |
| AC-06 | At 1440×900, 768×1024 and 390×844, content and actions remain usable without page-wide horizontal overflow. Check 200% zoom and reflow at 320 CSS pixels, including long labels, errors and table content. |
| AC-07 | Text, controls, focus and statuses remain readable on their actual surfaces; statuses include text or another meaningful cue. Measure contrast, review touch targets and test reduced-motion rendering. |
| AC-08 | Dependency installation, lint, formatting, typecheck, UI-package build and both app production builds pass under the existing workspace graph. Public/mobile/backend foundation checks remain passing. |
| AC-09 | Usage documentation covers theme import, exports, client boundaries, component composition and preview/check commands. Evidence records environment, viewport checks, results and limitations. |

For AC-07, use WCAG AA contrast checks as the verification procedure: 4.5:1 for
normal text, 3:1 for large text and meaningful non-text controls. This procedure
does not establish the separate production accessibility target in P9-U1. Check
actual foreground/background pairs; a palette token alone does not prove contrast.
If a required pairing fails, choose another existing token or document and resolve
a necessary token extension before declaring completion.

Run `./dev check` for the existing workspace/foundation checks. Use `./dev command`
and `./dev platform` to review the apps; consult the development runbook for
published ports. Add one focused, reproducible browser-check command during
implementation and record its actual invocation in the evidence. Automated checks
should exercise important interactions and shell routes; manual keyboard, visual,
contrast and reflow reviews are also required. Passing builds or an automated
accessibility scan alone cannot establish all acceptance criteria.

## Review of implementation size

**Recommendation: split P1-U4 into three sequential implementation subunits.**
The parent is cohesive, but visual setup, interactive component behavior and app
navigation each have a distinct reviewable outcome. Splitting avoids treating a
token/build check as proof that accessible app shells work.

These IDs refine P1-U4; they do not add delivery-plan units or change Phase 1 order.
Each starts `planned`. Activate and verify one at a time in the tracker.

| Subunit | Starting state / dependencies | Scope and expected result | Required verification |
| --- | --- | --- | --- |
| P1-U4a — Shared theme | P1-U2 plus UI context; empty UI exports and placeholder apps. | Shared tokens/fonts, Tailwind/shadcn conventions and package CSS/JSX exports consumed by both apps. A minimal sample proves the visual pipeline. | AC-01; scoped lint/typecheck/build and computed-style/font checks in both apps. |
| P1-U4b — Accessible primitives | P1-U4a verified. | Minimum component set and shared interactive preview examples available in both apps. | AC-02–04; component browser checks, contrast/reduced-motion review and preview reflow from AC-06–07. |
| P1-U4c — App shells and final integration | P1-U4a/b verified. | Distinct platform/command-center homes, app-owned navigation and responsive workspace regions composed from shared UI. Usage guide and evidence completed. | AC-05–09 plus integrated keyboard journey and final confirmation of AC-01–04; `./dev check` and focused browser command. |

P1-U4 completes only after all three subunits and the parent acceptance matrix
pass. Theme or primitive completion does not complete either shell. Keep the two
shells together initially: their shared requirement is verified by the same
navigation/reflow procedure. Split P1-U4c further only if implementation reveals
independent app work too large to review as one step.

## Decisions and remaining work

No product decision currently blocks this draft. Exact component APIs, compatible
dependency versions, local font assets and browser tooling are routine choices
to resolve against the workspace during implementation. No library version or
new check command is claimed to be installed by this document.

Before implementation: record the active subunit, required checks and baseline
in the tracker. After each verified increment: record actual evidence and remaining
work. Authentication enters in P2-U3/P2-U4; backend enforcement and later feature
units determine protected routes, authorized navigation and operational content.
