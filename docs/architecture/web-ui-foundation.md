# Web UI foundation

`@myims/ui-web` owns the shared visual system. Each web app imports
`@myims/ui-web/styles.css` once through its root `app/globals.css`, and explicitly
scans `packages/ui-web/src` with Tailwind's `@source` directive. Both apps use the
[Tailwind PostCSS integration](https://tailwindcss.com/docs/installation/framework-guides/nextjs).

The UI-context color variables remain the source palette. Tailwind semantic
utilities map to those variables: `bg-background`, `bg-card`, `bg-elevated`,
`text-foreground`, `text-muted-foreground`, `bg-primary`, `text-destructive`,
`border-border` and `ring-ring`. `text-muted-foreground` uses the secondary text
token for legibility on panels. Use state colors with text labels; use dark text
on filled accent/state backgrounds. A border alone must not be the only cue that
identifies a control.

Fonts are pinned Fontsource packages and bundled by the app build: Inter for UI,
Barlow Semi Condensed for headings, JetBrains Mono for identifiers. Latin font
assets and the selected weights are imported by shared CSS. No browser request
to Google Fonts is required. Font families are available through `font-sans`,
`font-display` and `font-mono`. The font packages include their SIL Open Font
License files; retain those licenses when distributing font assets.

The shared package compiles TypeScript/JSX to ESM before dependent app builds. CSS is a
separate source export processed by each app's PostCSS pipeline. UI components
must not import app modules, backend services or business permissions. Keep
interactive primitives at deliberate client boundaries; pages/layouts compose
them as Server Components.

Import controls and surfaces from `@myims/ui-web`. `Panel`/`PanelHeading`/`Divider`
compose content; `Button` accepts primary, secondary, destructive or ghost variants
and a `pending` flag. A pending button is disabled and exposes `aria-busy`.
`Input`, `Textarea`, `Select` and `Checkbox` forward native props. `Field` associates
its label with the supplied control ID; callers must pass the hint/error IDs in
`aria-describedby` and set `aria-invalid` when appropriate. Field error text uses
an elevated background because the error token on the panel surface falls below
4.5:1. Controls use stronger borders for visibility. Preserve form values in the
owning feature state when validation fails.

`Badge`, `Feedback` and `ContentState` provide labelled status/async treatments;
`Table` preserves native table semantics. Supply a caption and header scopes.
Only intrinsically wide table content should scroll within a labelled region.

`Overlay`, `OverflowMenu`, `Tabs` and `UiPreview` are client boundaries. Dialogs
and sheets share Radix modal behavior, including Escape dismissal, focus containment
and restoration. Supply a title, description and one button trigger. Overflow
items expose `onSelect`; tabs use explicit stable IDs. The shared `UiPreview` uses
local state to demonstrate errors, pending actions and recovery; it is not a domain
form or persistent record. `/ui-preview` in either app renders that same example.

Follow the [shadcn manual composition conventions](https://ui.shadcn.com/docs/installation/manual)
with Radix interaction primitives, class-variance-authority variants and a
`clsx`/`tailwind-merge` class utility. Our hand-authored MyIMS wrappers are
project-owned; no generator-owned source is edited. Add only components needed
by a current feature, and compose domain wrappers in their owning feature units.

`AppShell` owns reusable header, desktop navigation region, keyboard skip link
and compact navigation sheet. Each app supplies its own `AppNavigation`, uses
Next.js links and marks the current path with `aria-current="page"`. Planned
areas are text, not links. Selecting a compact navigation link closes the sheet.
Shell navigation is presentation; later identity units establish protected routes
and backend authorization. No tenant selector or pretend session is provided.
