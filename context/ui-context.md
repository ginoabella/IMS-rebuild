# UI Context

## Theme

MyIMS uses a dark, operations-room design language optimized for long-running command center sessions, rapid scanning, and high-information-density workflows. The interface should feel calm, controlled, and readable under pressure: deep slate surfaces, strong contrast, restrained color usage, and clear status coding. Bright colors are reserved for actions, alerts, responder states, and map markers rather than decorative accents.


The command center web app is desktop-first and intended for multi-panel workstations. Layouts should prioritize simultaneous visibility of call details, incident forms, dispatch status, and the operational map. Mobile surfaces can inherit the same design tokens, but the web command center defines the primary visual system.


## Colors

All app surfaces must use CSS custom properties. No hardcoded hex values in feature code.


| Role | CSS Variable | Value |
| --- | --- | --- |
| Page background | `--bg-base` | `#09111B` |
| Elevated background | `--bg-elevated` | `#0F1A26` |
| Surface | `--bg-surface` | `#132131` |
| Surface active | `--bg-surface-active` | `#1A2B3D` |
| Primary text | `--text-primary` | `#E8F0F7` |
| Secondary text | `--text-secondary` | `#B7C6D5` |
| Muted text | `--text-muted` | `#7F93A8` |
| Primary accent | `--accent-primary` | `#00B8D9` |
| Primary accent hover | `--accent-primary-strong` | `#00D2F7` |
| Warning | `--state-warning` | `#F4B942` |
| Error | `--state-error` | `#E45454` |
| Success | `--state-success` | `#2FBF71` |
| Info | `--state-info` | `#4DA3FF` |
| Border | `--border-default` | `#223548` |
| Border strong | `--border-strong` | `#314A62` |
| Focus ring | `--focus-ring` | `#7DE3F7` |
| Map incident | `--map-incident` | `#FF6B57` |
| Map responder | `--map-responder` | `#2FBF71` |
| Map geofence | `--map-geofence` | `#4DA3FF` |


Status color usage:
- `--state-error` is for urgent incidents, blocked workflows, disconnected services, and failed validations.
- `--state-warning` is for queued calls, pending actions, or cautionary operational states.
- `--state-success` is for available responders, completed actions, and healthy connected systems.
- `--state-info` is for informational call state, timeline events, and neutral operational highlights.




## Typography

| Role | Font | Variable |
| --- | --- | --- |
| UI text | `Inter` | `--font-sans` |
| Headings and numeric emphasis | `Barlow Semi Condensed` | `--font-display` |
| Code/mono | `JetBrains Mono` | `--font-mono` |


Typography rules:
- Use `Inter` for body text, forms, tables, labels, and dense operational UI.
- Use `Barlow Semi Condensed` for panel titles, incident numbers, responder call signs, and dashboard metrics.
- Use `JetBrains Mono` for timestamps, coordinates, caller IDs, status codes, and technical identifiers.
- Favor compact line heights and medium font weights over oversized text.


## Border Radius

| Context | Class |
| --- | --- |
| Inline / small UI | `rounded-md` |
| Cards / panels | `rounded-xl` |
| Modals / overlays | `rounded-2xl` |


Use clean edges and modest rounding. This is an operational tool, not a soft consumer UI.


## Component Library

Use `Tailwind CSS` with `shadcn/ui` as the baseline component library for the command center web app. Reusable components should live in `packages/ui-web` and be composed through app-level feature components rather than forked per screen.


Component conventions:
- Prefer `shadcn/ui` primitives for dialogs, sheets, popovers, forms, tables, tabs, toasts, and command menus.
- Create MyIMS-specific wrappers for incident status badges, responder chips, telephony status pills, map legends, timeline rows, and dispatch cards.


## Layout Patterns

- Command center shell: full-height app with a fixed top bar, optional left navigation rail, central operational workspace, and contextual side panels.
- Active dispatch workspace: split layout with incident or caller details on one side and a live map plus responder context on the other.
- Dashboard view: metric cards at the top, map and incident queues in the middle, trend or summary panels below.
- Incident detail view: sticky header with incident status and quick actions, followed by tabbed sections for caller data, timeline, responders, recordings, and notes.
- Side panels: fixed-width, scrollable, and border-separated; use them for filters, responder detail, caller history, and guide card lookup.
- Modals and drawers: use drawers for secondary operational tasks and modals only for confirmation, escalation, or focused data entry.
- Map region: always preserve a legend, visible layer controls, and quick visual distinction between incidents, responders, and boundaries.


## Responsive & Compact Layout

- Fit primary information and actions within the visible screen whenever practical.
- Keep layouts compact without reducing readability or usability.
- Reflow or reorganize content as available screen space becomes limited.
- Use progressive disclosure for secondary information through accordions, collapsible sections, expandable panels, tabs, or toggles.
- Do not hide critical information, warnings, validation errors, or primary actions inside collapsed content.
- Avoid horizontal scrolling unless the content inherently requires it.
- Ensure layouts remain usable across desktop, tablet, and mobile screen sizes.

## Forms & Inputs

- Keep forms easy to scan and group related fields together.
- Use clear and consistently positioned labels.
- Clearly distinguish required and optional fields.
- Use the input control that best matches the type of data being entered.
- Show field-level validation close to the affected input.
- Preserve entered values when validation fails.
- Keep primary form actions clear and consistently positioned.
- Use help text only when it adds necessary guidance.


## Tables & Data Display

- Prioritize the columns and information most important to the user's task.
- Keep column labels clear and concise.
- Align values consistently according to their type.
- Provide sorting, filtering, searching, or pagination when appropriate.
- Use concise status labels, badges, or icons where appropriate.
- Keep primary row actions visible and place secondary actions in an overflow menu when needed.
- Provide clear loading, empty, and no-result states.
- Allow horizontal scrolling only when the table cannot reasonably adapt to the available width.

## Interaction States

- Interactive components must have clear default, hover, focus, active, selected, and disabled states.
- Hover states should provide subtle feedback without changing layout.
- Focus states must remain clearly visible for keyboard navigation.
- Selected and active states must be visually distinguishable from hover states.
- Disabled controls must clearly appear unavailable.
- Destructive actions must be visually distinguishable from normal actions.

## Feedback & Status

- Provide clear feedback after important user actions.
- Use consistent treatment for success, information, warning, and error states.
- Show validation errors close to the affected field or content.
- Use inline feedback for local actions and notifications or toasts for broader application feedback.
- Show an appropriate loading state when an operation is in progress.
- Prevent duplicate submissions or actions while processing.
- Empty and no-result states should clearly explain the current condition and provide a relevant next action when applicable.
- Do not rely on color alone to communicate status.

## Icons

[e.g. Lucide React. Stroke-based icons only. Sizes:
h-4 w-4 for inline, h-5 w-5 for buttons.]

## Accessibility

- All interactive elements must support keyboard navigation.
- Maintain visible focus indicators.
- Maintain sufficient contrast between text, controls, backgrounds, and states.
- Do not use color as the only method of communicating meaning.
- Use semantic controls and appropriate accessible labels.
- Ensure form controls have associated labels.
- Provide accessible names for icon-only controls.
- Keep interactive targets large enough for comfortable mouse and touch use.
- Maintain readable text sizes across supported screen sizes.
- Respect reduced-motion preferences.
