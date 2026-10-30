# Platform tab-return scroll retention

Started: 2026-10-29. Completed: 2026-10-30 (Asia/Manila, +08:00).

## Change

Focus/visibility restoration runs a current-session check. Previously, the
protected workspace used `hidden` during that transient check, collapsing the long
form and causing the browser to clamp document scroll toward the top.

The platform console now retains the workspace layout while access is unknown.
Its contents stay invisible and inert, and a fixed checking status covers the
viewport. Successful validation reveals the same mounted form at its existing
position only after the validated session and ready context commit together;
`accept` no longer imperatively reveals an older rendered context. Tenant registry reads also retain the same owner/resource snapshot
while revalidation completes, rather than removing the detail panels on every
access transition. Changed resources and failed reads still clear/replace it;
operator changes remount the owner-bound shell. Denied access, reauthentication
and logout still use their ordinary screens. No scroll coordinates are persisted or restored across unrelated
navigation, and no session, authorization or mutation logic changed.

The browser access contract and onboarding manual guide describe the behavior.

## Verification

- The original production bundle failed the new pending-scroll equality check
  after window focus. The held response eventually reached its transport timeout
  while that equality assertion waited; the failure occurred at the scroll check.
- The focused regression starts below the initial viewport with an unsaved
  longitude. It holds each real session response for focus, cached `pageshow`
  and visibility restoration, checks that the input is concealed while pending,
  and compares scroll coordinates and the proposed input after validation.
- An intermediate presentation-only repair still moved scroll by 500 pixels;
  the regression exposed tenant detail being cleared on access transitions.
  The same-resource snapshot retention addresses this second source of collapse.
- Final affected ESLint, console TypeScript and isolated production build passed.
- An intermediate retained-notes assertion during idle-expiry setup timed out;
  the next confirmation was interrupted by the laptop disruption. Presentation
  now becomes visible only after the validated session and ready context commit.
- On resumption, `./dev exec pnpm check:draft-tenant --onboarding-browser`
  passed completely, exit 0, against the final code. This includes all three
  scroll/input-retention cases, geography/name/contact/voice groups, retained
  work across idle/absolute expiry, A/B access recovery, owner/target isolation,
  bounded authentication retries, and independent-process/audit redaction checks.
- Ordinary platform production rebuild/HTTPS refresh completed.
  `./dev platform-https-check` passed transport, access-denial, client-asset
  isolation and identity/data-preservation checks. `./dev health` returned
  live/ready HTTP 200 with the database and both Redis services up.
  Platform HTTPS and the existing staff HTTPS both report ready.

The browser checks use controlled lifecycle events through real Chromium,
Next/HTTPS/Nest and shared-session services. They do not establish hard-refresh
recovery of unsaved work or scroll restoration after session expiry/sign-in.
The full repository/foundation graph is outside this focused presentation repair.
